import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import axios from "axios"
import { formatPrice, formatDate } from "../../utils/format"
import { API_URL } from "../../constants"
import "./Orders.css"

// Past Orders page (stretch). Lists all orders, newest first, with an email
// filter that hits GET /orders?email=<value>.
function Orders() {
  const [orders, setOrders] = useState([])
  const [emailFilter, setEmailFilter] = useState("")
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState(null)

  const fetchOrders = async (email) => {
    setIsFetching(true)
    setError(null)
    try {
      const url = email ? `${API_URL}/orders?email=${encodeURIComponent(email)}` : `${API_URL}/orders`
      const { data } = await axios.get(url)
      setOrders(data.orders)
    } catch (err) {
      console.error("Failed to fetch orders:", err)
      setError("Failed to load orders. Is the API server running?")
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => {
    fetchOrders("")
  }, [])

  const handleSubmit = (event) => {
    event.preventDefault()
    fetchOrders(emailFilter.trim())
  }

  return (
    <div className="Orders">
      <div className="content">
        <h1>Past Orders</h1>

        <form className="filter" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Filter by email…"
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
          />
          <button type="submit">Filter</button>
          {emailFilter && (
            <button
              type="button"
              className="clear"
              onClick={() => {
                setEmailFilter("")
                fetchOrders("")
              }}
            >
              Clear
            </button>
          )}
        </form>

        {error && <p className="error">{error}</p>}
        {isFetching ? (
          <p>Loading…</p>
        ) : orders.length === 0 ? (
          <p className="empty">No orders found.</p>
        ) : (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Email</th>
                <th>Status</th>
                <th>Items</th>
                <th>Total</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/orders/${order.id}`}>#{order.id}</Link>
                  </td>
                  <td>{order.customer}</td>
                  <td>{order.email}</td>
                  <td>
                    <span className={`status status-${order.status}`}>{order.status}</span>
                  </td>
                  <td>{order.orderItems.reduce((acc, item) => acc + item.quantity, 0)}</td>
                  <td>{formatPrice(order.totalPrice)}</td>
                  <td>{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Orders
