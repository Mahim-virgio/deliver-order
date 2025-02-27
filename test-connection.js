#!/usr/bin/env node

const axios = require("axios");
require("dotenv").config();

// Shopify API credentials from environment variables
const SHOP_NAME = process.env.SHOPIFY_SHOP_NAME;
const ACCESS_TOKEN = process.env.SHOPIFY_PASSWORD;

// GraphQL endpoint
const endpoint = `https://${SHOP_NAME}.myshopify.com/admin/api/2023-10/graphql.json`;

// Headers for GraphQL requests
const headers = {
  "X-Shopify-Access-Token": ACCESS_TOKEN,
  "Content-Type": "application/json",
};

async function testConnection() {
  try {
    console.log("Testing Shopify GraphQL API connection...");
    console.log(`Shop: ${SHOP_NAME}`);
    console.log(
      `Token first/last 4 chars: ${ACCESS_TOKEN.substring(
        0,
        4
      )}...${ACCESS_TOKEN.substring(ACCESS_TOKEN.length - 4)}`
    );

    // Test query to get shop information
    const query = `
      {
        shop {
          name
          id
          url
        }
      }
    `;

    const response = await axios.post(endpoint, { query }, { headers });

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors, null, 2));
    }

    console.log("\n✅ Connection successful!");
    console.log(`Shop name: ${response.data.data.shop.name}`);
    console.log(`Shop ID: ${response.data.data.shop.id}`);
    console.log(`Shop URL: ${response.data.data.shop.url}`);

    // Get recent orders for testing
    const ordersQuery = `
      {
        orders(first: 5, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              displayFulfillmentStatus
              createdAt
            }
          }
        }
      }
    `;

    const ordersResponse = await axios.post(
      endpoint,
      { query: ordersQuery },
      { headers }
    );

    if (ordersResponse.data.errors) {
      throw new Error(JSON.stringify(ordersResponse.data.errors, null, 2));
    }

    const orders = ordersResponse.data.data.orders.edges;

    if (orders.length > 0) {
      console.log("\nRecent orders you can use for testing:");
      orders.forEach(({ node }) => {
        // Extract numeric ID from GraphQL ID
        const numericId = node.id.split("/").pop();
        console.log(
          `- Order ${node.name} (ID: ${numericId}, Full ID: ${node.id})`
        );
        console.log(
          `  Status: ${node.displayFulfillmentStatus}, Created: ${node.createdAt}`
        );
      });
      console.log(
        "\nYou can use either the numeric ID or the full GraphQL ID with this script."
      );
    } else {
      console.log("\nNo recent orders found.");
    }
  } catch (error) {
    console.error("\n❌ Connection failed!");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error("Response data:", error.response.data);
    } else {
      console.error("Error message:", error.message);
    }

    console.log("\n🔍 Troubleshooting tips:");
    console.log(
      "1. Verify your SHOPIFY_SHOP_NAME in .env is correct (only the subdomain)"
    );
    console.log(
      "2. Check that your SHOPIFY_PASSWORD (access token) is correct"
    );
    console.log(
      "3. Ensure your app has the required permissions for GraphQL API access"
    );
    console.log("   (Specifically, you need orders and fulfillments access)");
  }
}

testConnection();
