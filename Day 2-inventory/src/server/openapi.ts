export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Inventory Management API",
    version: "0.1.0",
    description: "REST API for managing products, stock, orders, and alerts",
  },
  servers: [{ url: "http://localhost:3000" }],
  security: [{ apiKey: [] }],
  components: {
    securitySchemes: {
      apiKey: {
        type: "apiKey" as const,
        in: "header" as const,
        name: "X-API-Key",
      },
    },
    schemas: {
      Product: {
        type: "object",
        properties: {
          id: { type: "integer" },
          sku: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          price: { type: "number" },
          cost: { type: "number" },
          deleted_at: { type: "string", nullable: true },
          created_at: { type: "string" },
          updated_at: { type: "string" },
        },
      },
      StockStatus: {
        type: "object",
        properties: {
          sku: { type: "string" },
          product_name: { type: "string" },
          warehouse: { type: "string" },
          quantity: { type: "integer" },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "integer" },
          customer_name: { type: "string" },
          status: { type: "string", enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"] },
          total_amount: { type: "number" },
          created_at: { type: "string" },
          updated_at: { type: "string" },
          items: { type: "array", items: { $ref: "#/components/schemas/OrderItem" } },
        },
      },
      OrderItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          order_id: { type: "integer" },
          product_id: { type: "integer" },
          sku: { type: "string" },
          quantity: { type: "integer" },
          unit_price: { type: "number" },
          subtotal: { type: "number" },
        },
      },
      StockAlert: {
        type: "object",
        properties: {
          sku: { type: "string" },
          product_name: { type: "string" },
          warehouse: { type: "string" },
          current: { type: "integer" },
          minimum: { type: "integer" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/api/products": {
      get: {
        tags: ["Products"],
        summary: "List all products",
        responses: {
          "200": {
            description: "List of products",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Product" } } } },
          },
        },
      },
      post: {
        tags: ["Products"],
        summary: "Add a new product",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sku", "name", "price"],
                properties: {
                  sku: { type: "string" },
                  name: { type: "string" },
                  price: { type: "number" },
                  cost: { type: "number" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Product created", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Duplicate SKU", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/products/{sku}": {
      get: {
        tags: ["Products"],
        summary: "Get product by SKU",
        parameters: [{ name: "sku", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Product found", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } },
          "404": { description: "Not found" },
        },
      },
      patch: {
        tags: ["Products"],
        summary: "Update a product",
        parameters: [{ name: "sku", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  price: { type: "number" },
                  cost: { type: "number" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Product updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } },
          "404": { description: "Not found" },
        },
      },
      delete: {
        tags: ["Products"],
        summary: "Soft-delete a product",
        parameters: [{ name: "sku", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Deleted" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/stock/in": {
      post: {
        tags: ["Stock"],
        summary: "Receive stock",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sku", "quantity", "warehouse"],
                properties: {
                  sku: { type: "string" },
                  quantity: { type: "integer", minimum: 1 },
                  warehouse: { type: "string" },
                  note: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Stock received" },
          "404": { description: "Product or warehouse not found" },
        },
      },
    },
    "/api/stock/out": {
      post: {
        tags: ["Stock"],
        summary: "Ship stock out",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sku", "quantity", "warehouse"],
                properties: {
                  sku: { type: "string" },
                  quantity: { type: "integer", minimum: 1 },
                  warehouse: { type: "string" },
                  note: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Stock shipped" },
          "409": { description: "Insufficient stock" },
        },
      },
    },
    "/api/stock/status": {
      get: {
        tags: ["Stock"],
        summary: "Get stock status",
        parameters: [
          { name: "sku", in: "query", schema: { type: "string" } },
          { name: "warehouse", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Stock status list", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/StockStatus" } } } } },
        },
      },
    },
    "/api/stock/transfer": {
      post: {
        tags: ["Stock"],
        summary: "Transfer stock between warehouses",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sku", "from", "to", "quantity"],
                properties: {
                  sku: { type: "string" },
                  from: { type: "string" },
                  to: { type: "string" },
                  quantity: { type: "integer", minimum: 1 },
                  note: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Transfer complete" },
          "409": { description: "Insufficient stock" },
        },
      },
    },
    "/api/stock/warehouse": {
      post: {
        tags: ["Stock"],
        summary: "Add a warehouse",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  location: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Warehouse created" },
        },
      },
    },
    "/api/stock/threshold": {
      post: {
        tags: ["Alerts"],
        summary: "Set stock threshold",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sku", "warehouse", "min_quantity"],
                properties: {
                  sku: { type: "string" },
                  warehouse: { type: "string" },
                  min_quantity: { type: "integer", minimum: 0 },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Threshold set" } },
      },
    },
    "/api/stock/alerts": {
      get: {
        tags: ["Alerts"],
        summary: "Get stock alerts",
        responses: {
          "200": { description: "Active alerts", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/StockAlert" } } } } },
        },
      },
    },
    "/api/orders": {
      get: {
        tags: ["Orders"],
        summary: "List orders",
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "customer_name", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "List of orders", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Order" } } } } },
        },
      },
      post: {
        tags: ["Orders"],
        summary: "Create an order",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["customer_name", "items"],
                properties: {
                  customer_name: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["sku", "quantity"],
                      properties: {
                        sku: { type: "string" },
                        quantity: { type: "integer", minimum: 1 },
                      },
                    },
                  },
                  warehouse: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Order created", content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } } },
          "409": { description: "Insufficient stock" },
        },
      },
    },
    "/api/import/products": {
      post: {
        tags: ["Import"],
        summary: "Import products from CSV file",
        operationId: "importProducts",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: { type: "string", description: "Filename within the uploads directory" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Import result with ok/failed counts" },
          "400": { description: "Missing file or path traversal attempt" },
        },
      },
    },
    "/api/orders/{id}/status": {
      patch: {
        tags: ["Orders"],
        summary: "Update order status",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: { type: "string", enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Status updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } } },
        },
      },
    },
  },
};
