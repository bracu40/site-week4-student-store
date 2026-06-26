import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import axios from "axios"
import { formatPrice, formatDate } from "../../utils/format"
import { API_URL } from "../../constants"
import "./OrderDetail.css"

// Individual order detail page (stretch). Shows the order metadata plus a line
// item table built from GET /orders/:id.
function OrderDetail() {
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchOrder = async () => {
      setIsFetching(true)
      setError(null)
      try {
        const { data } = await axios.get(`${API_URL}/orders/${orderId}`)
        setOrder(data.order)
      } catch (err) {
        console.error(`Failed to fetch order ${orderId}:`, err)
        setError(err?.response?.data?.error || "Order not found")
      } finally {
        setIsFetching(false)
      }
    }

    fetchOrder()
  }, [orderId])

  if (isFetching) return <div className="OrderDetail"><p>Loading…</p></div>
  if (error) {
    return (
      <div className="OrderDetail">
        <p className="error">{error}</p>
        <Link to="/orders">← Back to all orders</Link>
      </div>
    )
  }

  return (
    <div className="OrderDetail">
      <div className="content">
        <Link className="back" to="/orders">
          ← Back to all orders
        </Link>

        <h1>Order #{order.id}</h1>

        <div className="meta">
          <div><span className="label">Customer</span> {order.customer}</div>
          <div><span className="label">Email</span> {order.email}</div>
          <div>
            <span className="label">Status</span>{" "}
            <span className={`status status-${order.status}`}>{order.status}</span>
          </div>
          <div><span className="label">Placed</span> {formatDate(order.createdAt)}</div>
        </div>

        <table className="items-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Unit Price</th>
              <th>Quantity</th>
              <th>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {order.orderItems.map((item) => (
              <tr key={item.id}>
                <td>{item.product ? item.product.name : `Product #${item.productId} (removed)`}</td>
                <td>{formatPrice(item.price)}</td>
                <td>{item.quantity}</td>
                <td>{formatPrice(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="total-label">Total</td>
              <td className="total-value">{formatPrice(order.totalPrice)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default OrderDetail
