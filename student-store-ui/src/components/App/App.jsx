import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import SubNavbar from "../SubNavbar/SubNavbar";
import Sidebar from "../Sidebar/Sidebar";
import Home from "../Home/Home";
import ProductDetail from "../ProductDetail/ProductDetail";
import Orders from "../Orders/Orders";
import OrderDetail from "../OrderDetail/OrderDetail";
import NotFound from "../NotFound/NotFound";
import { removeFromCart, addToCart, getQuantityOfItemInCart, getTotalItemsInCart } from "../../utils/cart";
import { API_URL } from "../../constants";
import "./App.css";

function App() {

  // State variables
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All Categories");
  const [searchInputValue, setSearchInputValue] = useState("");
  const [userInfo, setUserInfo] = useState({ name: "", email: "" });
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [isFetching, setIsFetching] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);

  // Toggles sidebar
  const toggleSidebar = () => setSidebarOpen((isOpen) => !isOpen);

  // Fetch the product catalog from the API on mount.
  useEffect(() => {
    const fetchProducts = async () => {
      setIsFetching(true);
      setError(null);
      try {
        const { data } = await axios.get(`${API_URL}/products`);
        setProducts(data.products);
      } catch (err) {
        console.error("Failed to fetch products:", err);
        setError("Failed to load products. Is the API server running?");
      } finally {
        setIsFetching(false);
      }
    };

    fetchProducts();
  }, []);

  // Functions to change state (used for lifting state)
  const handleOnRemoveFromCart = (item) => setCart(removeFromCart(cart, item));
  const handleOnAddToCart = (item) => setCart(addToCart(cart, item));
  const handleGetItemQuantity = (item) => getQuantityOfItemInCart(cart, item);
  const handleGetTotalCartItems = () => getTotalItemsInCart(cart);

  const handleOnSearchInputChange = (event) => {
    setSearchInputValue(event.target.value);
  };

  // Place the order: turn the cart into the POST /orders body the API expects,
  // submit it, then build the receipt shape that CheckoutSuccess renders.
  const handleOnCheckout = async () => {
    // Cart is a map of { productId: quantity }. Build the items array.
    const items = Object.keys(cart).map((productId) => ({
      productId: Number(productId),
      quantity: cart[productId],
    }));

    if (items.length === 0) {
      setError("Your cart is empty. Add an item before checking out.");
      return;
    }
    if (!userInfo.name || !userInfo.email) {
      setError("Please enter your name and email before checking out.");
      return;
    }

    setIsCheckingOut(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API_URL}/orders`, {
        customer: userInfo.name,
        email: userInfo.email,
        items,
      });

      const createdOrder = data.order;

      // Build the receipt lines CheckoutSuccess expects at order.purchase.receipt.lines
      const receiptLines = [
        `Thanks for your order, ${createdOrder.customer}!`,
        ...createdOrder.orderItems.map(
          (item) =>
            `${item.quantity} x ${item.product.name} @ $${item.price.toFixed(2)} = $${(
              item.price * item.quantity
            ).toFixed(2)}`
        ),
        `Order total: $${createdOrder.totalPrice.toFixed(2)}`,
        `A confirmation email will be sent to ${createdOrder.email}.`,
      ];

      setOrder({
        ...createdOrder,
        purchase: { receipt: { lines: receiptLines } },
      });
      setCart({});
    } catch (err) {
      console.error("Checkout failed:", err);
      setError(err?.response?.data?.error || "Checkout failed. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };


  return (
    <div className="App">
      <BrowserRouter>
        <Sidebar
          cart={cart}
          error={error}
          userInfo={userInfo}
          setUserInfo={setUserInfo}
          isOpen={sidebarOpen}
          products={products}
          toggleSidebar={toggleSidebar}
          isCheckingOut={isCheckingOut}
          addToCart={handleOnAddToCart}
          removeFromCart={handleOnRemoveFromCart}
          getQuantityOfItemInCart={handleGetItemQuantity}
          getTotalItemsInCart={handleGetTotalCartItems}
          handleOnCheckout={handleOnCheckout}
          order={order}
          setOrder={setOrder}
        />
        <main>
          <SubNavbar
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            searchInputValue={searchInputValue}
            handleOnSearchInputChange={handleOnSearchInputChange}
          />
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  error={error}
                  products={products}
                  isFetching={isFetching}
                  activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory}
                  addToCart={handleOnAddToCart}
                  searchInputValue={searchInputValue}
                  removeFromCart={handleOnRemoveFromCart}
                  getQuantityOfItemInCart={handleGetItemQuantity}
                />
              }
            />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:orderId" element={<OrderDetail />} />
            <Route
              path="/products/:productId"
              element={
                <ProductDetail
                  cart={cart}
                  error={error}
                  products={products}
                  addToCart={handleOnAddToCart}
                  removeFromCart={handleOnRemoveFromCart}
                  getQuantityOfItemInCart={handleGetItemQuantity}
                />
              }
            />
            <Route
              path="/:productId"
              element={
                <ProductDetail
                  cart={cart}
                  error={error}
                  products={products}
                  addToCart={handleOnAddToCart}
                  removeFromCart={handleOnRemoveFromCart}
                  getQuantityOfItemInCart={handleGetItemQuantity}
                />
              }
            />
            <Route
              path="*"
              element={
                <NotFound
                  error={error}
                  products={products}
                  activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory}
                />
              }
            />
          </Routes>
        </main>
      </BrowserRouter>
    </div>
  );
}

export default App;
 