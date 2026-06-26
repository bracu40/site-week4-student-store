import { Link } from "react-router-dom"
import "./SubNavbar.css"

function SubNavbar({ activeCategory, setActiveCategory, searchInputValue, handleOnSearchInputChange }) {


  const categories = ["All Categories", "Accessories", "Apparel", "Books", "Snacks", "Supplies"];

  return (
    <nav className="SubNavbar">

      <div className="content">

        <div className="row">
          <div className="search-bar">
            <input
              type="text"
              name="search"
              placeholder="Search"
              value={searchInputValue}
              onChange={handleOnSearchInputChange}
            />
            <i className="material-icons">search</i>
          </div>
          <Link className="orders-link" to="/orders">
            Past Orders
          </Link>
        </div>

        <div className="row">
          <ul className={`category-menu`}>
            {categories.map((cat) => (
              <li className={activeCategory === cat ? "is-active" : ""} key={cat}>
                <button onClick={() => setActiveCategory(cat)}>{cat}</button>
              </li>
            ))}
          </ul>
        </div>
        
      </div>
    </nav>
  )
}

export default SubNavbar;