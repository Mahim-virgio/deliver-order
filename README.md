# Shopify Order Delivery Script

A simple Node.js script to mark test Shopify orders delivered.

## 📌 Installation & Setup

1. **Clone the Repository**  
   ```sh
   git clone https://github.com/Mahim-virgio/deliver-order.git
   cd deliver-order
   ```

2. **In the root directory, create a .env file and add your Shopify Developer credentials:**
   ```sh
   SHOPIFY_SHOP_NAME=your-shop-name
   SHOPIFY_PASSWORD=your-api-password
   ```
3. ***Install Dependencies**
   ```sh
   npm install
   ```

## 🚀 Usage

1. **✅ Check Connection**

   Ensure that the .env file is correctly set up by running:

   ```sh
   node test-connection
   ```

2. **📦 Mark an Order as Delivered**
   ```sh
   node index.js {order_id}
   ```
   Replace {order_id} with the actual Shopify order ID.






   
