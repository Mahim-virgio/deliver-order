#!/usr/bin/env node

const axios = require("axios");
require("dotenv").config();

// Shopify API credentials from environment variables
const SHOP_NAME = process.env.SHOPIFY_SHOP_NAME;
const ACCESS_TOKEN = process.env.SHOPIFY_PASSWORD;

// GraphQL endpoint
const endpoint = `https://${SHOP_NAME}.myshopify.com/admin/api/2024-10/graphql.json`;
const restEndpoint = `https://${SHOP_NAME}.myshopify.com/admin/api/2023-10`;

// Headers for GraphQL requests
const headers = {
  "X-Shopify-Access-Token": ACCESS_TOKEN,
  "Content-Type": "application/json",
};

const restHeaders = {
  "X-Shopify-Access-Token": ACCESS_TOKEN,
  "Content-Type": "application/json",
  Cookie: "request_method=POST",
};

// Function to execute GraphQL queries
async function executeQuery(query, variables = {}) {
  try {
    const response = await axios.post(
      endpoint,
      { query, variables },
      { headers }
    );

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors, null, 2));
    }

    return response.data.data;
  } catch (error) {
    if (error.response) {
      console.error(
        `GraphQL Error (${error.response.status}):`,
        error.response.data
      );
    } else {
      console.error("GraphQL Error:", error.message);
    }
    throw error;
  }
}

// Function to get order details
async function getOrder(orderId) {
  console.log(`Getting details for order ${orderId}...`);

  const query = `
  query GetOrder($id: ID!) {
   order(id: $id) {
     id
     name
     fulfillable
     fulfillments(first: 5) {
       id
       status
     }
     lineItems(first: 50) {
       edges {
         node {
           id
           quantity
           fulfillableQuantity
         }
       }
     }
     fulfillmentOrders(first: 5) {
       edges {
         node {
           id
           status
           lineItems(first: 50) {
             edges {
               node {
                 id
               }
             }
           }
         }
       }
     }
   }
 }
 `;

  // GraphQL requires the full ID with prefix
  const formattedOrderId = orderId.includes("gid://")
    ? orderId
    : `gid://shopify/Order/${orderId}`;

  const data = await executeQuery(query, { id: formattedOrderId });

  if (!data.order) {
    throw new Error(`Order ${orderId} not found`);
  }

  console.log(
    `Found order ${data.order.name} with status: ${data.order.fulfillable}`
  );

  return data.order;
}

// Function to create fulfillment
async function createFulfillment(fulfillmentOrderId, lineItems) {
  console.log(lineItems);
  const mutation = `
    mutation FulfillOrder($fulfillment: FulfillmentInput!) {
        fulfillmentCreate(fulfillment: $fulfillment) {
            fulfillment {
            id
            status
            }
            userErrors {
            field
            message
            }
        }
    }
`;

  const variables = {
    fulfillment: {
      lineItemsByFulfillmentOrder: [
        {
          fulfillmentOrderId: fulfillmentOrderId,
          fulfillmentOrderLineItems: lineItems.map((item) => ({
            id: item.fulfillmentOrderId,
            quantity: item.quantity,
          })),
        },
      ],
      notifyCustomer: true,
    },
  };

  const data = await executeQuery(mutation, variables);

  if (
    data.fulfillmentCreate.userErrors &&
    data.fulfillmentCreate.userErrors.length > 0
  ) {
    throw new Error(
      `Failed to create fulfillment: ${JSON.stringify(
        data.fulfillmentCreate.userErrors,
        null,
        2
      )}`
    );
  }

  console.log(
    `Fulfillment created with ID: ${data.fulfillmentCreate.fulfillment.id}`
  );

  return data.fulfillmentCreate.fulfillment.id;
}

const getFormattedIdFromShopifyId = (id) => {
  const idSplitted = id.split("/");
  return idSplitted[idSplitted.length - 1];
};

// Function to mark fulfillment as delivered
async function markAsDelivered(orderId, fulfillmentId) {
  console.log(
    `Marking fulfillment ${getFormattedIdFromShopifyId(
      fulfillmentId
    )} for order ${getFormattedIdFromShopifyId(orderId)} as delivered...`
  );

  try {
    // Using the exact same endpoint and payload structure as your curl command
    await axios.post(
      `${restEndpoint}/orders/${getFormattedIdFromShopifyId(
        orderId
      )}/fulfillments/${getFormattedIdFromShopifyId(
        fulfillmentId
      )}/events.json`,
      {
        event: {
          status: "delivered",
        },
      },
      { headers: restHeaders }
    );

    console.log(
      `✅ Fulfillment ${fulfillmentId} for order ${orderId} has been marked as delivered!`
    );
    return true;
  } catch (error) {
    console.error("Error marking as delivered:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error("Response:", error.response.data);
    } else {
      console.error("Error message:", error.message);
    }
    throw error;
  }
}
// Main function to process an order
async function processOrder(orderId) {
  try {
    // Step 1: Get order details
    const order = await getOrder(orderId);
    const id = order.id;
    // Check if order is already fulfilled
    const existingFulfillments = order.fulfillments || [];
    let fulfillmentId;
    console.log("STEP 2", order);
    if (existingFulfillments.length > 0) {
      console.log(existingFulfillments);
      await markAsDelivered(id, existingFulfillments[0].id);
      console.log("marked delivered: " + existingFulfillments[0].id);
    } else if (order.fulfillable) {
      // Create a new fulfillment
      console.log("STEP 2.1 ", order.fulfillmentOrders.edges[0].node.id);
      const fulfillmentOrderId = order.fulfillmentOrders.edges[0].node.id;
      const lineItems =
        order.fulfillmentOrders.edges[0].node.lineItems.edges.map((edge) => ({
          fulfillmentOrderId: edge.node.id,
          quantity: 1,
        }));

      fulfillmentId = await createFulfillment(fulfillmentOrderId, lineItems);
      console.log("fullfilment id", fulfillmentId);
      await markAsDelivered(id, fulfillmentId);
    } else {
      throw new Error("Order is not fulfillable");
    }

    // Step 2: Mark fulfillment as delivered

    console.log(
      `Order ${orderId} has been successfully fulfilled and marked as delivered!`
    );
  } catch (error) {
    console.error("Failed to process order:", error.message);
    process.exit(1);
  }
}

// Get order ID from command line arguments
const orderId = process.argv[2];

if (!orderId) {
  console.error("Please provide an order ID");
  console.log("Usage: node index.js <orderId>");
  process.exit(1);
}

// Check if environment variables are set
if (!SHOP_NAME || !ACCESS_TOKEN) {
  console.error("Missing Shopify API credentials in environment variables");
  console.log("Please set SHOPIFY_SHOP_NAME and SHOPIFY_PASSWORD");
  process.exit(1);
}

// Process the order
processOrder(orderId);
