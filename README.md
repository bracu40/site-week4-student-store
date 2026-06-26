## Unit Assignment: Student Store

Submitted by: **Brandon Curo**

Deployed Application (optional): N/A (run locally — see `student-store-api/README.md`)

### Application Features

#### CORE FEATURES

- [x] **Database Creation**: Set up a Postgres database to store information about products and orders.
  - [x]  Use Prisma to define models for `products`, `orders`, and `order_items`.
  - [x]  **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: Use Prisma Studio to demonstrate the creation of your `products`, `orders`, and `order_items` tables. 
- [x] **Products Model**
  - [x] Develop a products model to represent individual items available in the store. 
  - [x] This model should at minimum include the attributes:
    - [x] `id`
    - [x] `name`
    - [x] `description`
    - [x] `price` 
    - [x] `image_url`
    - [x] `category`
  - [x] Implement methods for CRUD operations on products.
  - [x] Ensure transaction handling such that when an product is deleted, any `order_items` that reference that product are also deleted. 
  - [x] **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: Use Prisma Studio to demonstrate the creation of all attributes (table columns) in your Products Model.
- [x] **Orders Model**
  - [x] Develop a model to manage orders. 
  - [x] This model should at minimum include the attributes:
    - [x] `order_id`
    - [x] `customer_id`
    - [x] `total_price`
    - [x] `status`
    - [x] `created_at`
  - [x] Implement methods for CRUD operations on orders.
  - [x] Ensure transaction handling such that when an order is deleted, any `order_items` that reference that order are also deleted. 
  - [x] **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: Use Prisma Studio to demonstrate the creation of all attributes (table columns) in your Order Model.

- [x] **Order Items Model**
  - [x] Develop a model to represent the items within an order. 
  - [x] This model should at minimum include the attributes:
    - [x] `order_item_id`
    - [x] `order_id`
    - [x] `product_id`
    - [x] `quantity`
    - [x] `price`
  - [x] Implement methods for fetching and creating order items.  
  - [x] **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: Use Prisma Studio to demonstrate the creation of all attributes (table columns) in your Order Items Model.
- [x] **API Endpoints**
  - [x] Application supports the following **Product Endpoints**:
    - [x] `GET /products`: Fetch a list of all products.
    - [x] `GET /products/:id`: Fetch details of a specific product by its ID.
    - [x] `POST /products`: Add a new product to the database.
    - [x] `PUT /products/:id`: Update the details of an existing product.
    - [x] `DELETE /products/:id`: Remove a product from the database.
  - [x] Application supports the following **Order Endpoints**:
    - [x] `GET /orders`: Fetch a list of all orders.
    - [x] `GET /orders/:order_id`: Fetch details of a specific order by its ID, including the order items.
    - [x] `POST /orders`: Create a new order with specified order items.
    - [x] `PUT /orders/:order_id`: Update the details of an existing order (e.g., change status).
    - [x] `DELETE /orders/:order_id`: Remove an order from the database.
    - [x] **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: Use Postman or another API testing tool to demonstrate the successful implementation of each endpoint. For the `DELETE` endpoints, please use Prisma Studio to demonstrate that any relevant order items have been deleted. 
- [x] **Frontend Integration**
  - [x] Connect the backend API to the provided frontend interface, ensuring dynamic interaction for product browsing, cart management, and order placement. Adjust the frontend as necessary to work with your API.
  - [x] Ensure the home page displays products contained in the product table.
  - [x] **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: Use `npm start` to run your server and display your website in your browser. 
    - [x] Demonstrate that users can successfully add items to their shopping cart, delete items from their shopping cart, and place an order
    - [x] After placing an order use Postman or Prisma Studio demonstrate that a corresponding order has been created in your orders table.

### Stretch Features

- [x] **Added Endpoints**
  - [x] `GET /order-items`: Create an endpoint for fetching all order items in the database.
  - [x] `POST /orders/:order_id/items` Create an endpoint that adds a new order item to an existing order. 
- [x] **Past Orders Page**
  - [x] Build a page in the UI that displays the list of all past orders.
  - [x] The page lists all past orders for the user, including relevant information such as:
    - [x] Order ID
    - [x] Date
    - [x] Total cost
    - [x] Order status.
  - [x] The user should be able to click on any individual order to take them to a separate page detailing the transaction.
  - [x] The individual transaction page provides comprehensive information about the transaction, including:
    - [x] List of order items
    - [x] Order item quantities
    - [x] Individual order item costs
    - [x] Total order cost
- [x] **Filter Orders**.
  - [x] Create an input on the Past Orders page of the frontend application that allows the user to filter orders by the email of the person who placed the order. 
  - [x] Users can type in an email and click a button to filter the orders.
  - [x] Upon entering an email address and submitting the input, the list of orders is filtered to only show orders placed by the user with the provided email. 
  - [x] The user can easily navigate back to the full list of orders after filtering. 
    - [x] Proper error handling is implemented, such as displaying "no orders found" when an invalid email is provided.
- [ ] **Deployment**
  - [ ] Website is deployed using [Render](https://courses.codepath.org/snippets/site/render_deployment_guide).
  - [ ] **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: To ease the grading process, please use the deployed version of your website in your walkthrough with the URL visible. 



### Walkthrough Video

[![Watch the walkthrough](https://cdn.loom.com/sessions/thumbnails/2307b51637494fca83e1bc45e21a896b-with-play.gif)](https://www.loom.com/share/2307b51637494fca83e1bc45e21a896b)

> ▶️ Click the thumbnail above to watch the full walkthrough on Loom.

### Reflection

* Did the topics discussed in your labs prepare you to complete the assignment? Be specific, which features in your weekly assignment did you feel unprepared to complete?

Yes, for the most part. The labs covered the fundamentals I leaned on every day: defining Prisma models, running migrations, wiring up Express routes, and connecting a React frontend with axios. Setting up the three models and the basic CRUD endpoints followed directly from what we practiced.

* If you had more time, what would you have done differently? Would you have added additional features? Changed the way your project responded to a particular event, etc.

A few things:
- Store money as a decimal instead of float. Float is fine for this project, but binary floating point can introduce tiny rounding errors on currency. Decimal is the correct type for money.
- **Track inventory/stock.** I'd add a stock count to Product and decrement it inside the same transaction as order creation, so the atomic write also prevents overselling.

* Reflect on your project demo, what went well? Were there things that maybe didn't go as planned? Did you notice something that your peer did that you would like to try next time?

The demo went well, I would say. I covered everything I planned on covering. I did note that I was looking at the screen more than I should have while presenting.

### Open-source libraries used

### Shout out

Shout out to Devarsh for explaining and answering my questions regarding the structure of the presentation.
