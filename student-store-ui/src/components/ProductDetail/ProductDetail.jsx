import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import NotFound from "../NotFound/NotFound";
import { formatPrice } from "../../utils/format";
import { API_URL } from "../../constants";
import "./ProductDetail.css";

function ProductDetail({ addToCart, removeFromCart, getQuantityOfItemInCart }) {

  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);

  // Fetch this product by id whenever the route param changes.
  useEffect(() => {
    const fetchProduct = async () => {
      setIsFetching(true);
      setError(null);
      try {
        const { data } = await axios.get(`${API_URL}/products/${productId}`);
        setProduct(data.product);
      } catch (err) {
        console.error(`Failed to fetch product ${productId}:`, err);
        setError("Product not found");
      } finally {
        setIsFetching(false);
      }
    };

    fetchProduct();
  }, [productId]);

  if (error) {
    return <NotFound />;
  }

  if (isFetching || !product) {
    return <h1>Loading...</h1>;
  }

  const quantity = getQuantityOfItemInCart(product);

  const handleAddToCart = () => {
    if (product.id) {
      addToCart(product)
    }
  };

  const handleRemoveFromCart = () => {
    if (product.id) {
      removeFromCart(product);
    }
  };

  return (
    <div className="ProductDetail">
      <div className="product-card">
        <div className="media">
          <img src={product.imageUrl || "/placeholder.png"} alt={product.name} />
        </div>
        <div className="product-info">
          <p className="product-name">{product.name}</p>
          <p className="product-price">{formatPrice(product.price)}</p>
          <p className="description">{product.description}</p>
          <div className="actions">
            <button onClick={handleAddToCart}>Add to Cart</button>
            {quantity > 0 && <button onClick={handleRemoveFromCart}>Remove from Cart</button>}
            {quantity > 0 && <span className="quantity">Quantity: {quantity}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}


export default ProductDetail;