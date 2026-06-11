import { NavLink } from "react-router-dom";
import { FaHome, FaUsers, FaUserMd, FaNewspaper, FaPaw, FaFileAlt, FaTimes } from "react-icons/fa";

interface AdminSidebarProps {
  userRole: string;
  isOpen: boolean;
  onClose: () => void;
}

const AdminSidebar = ({ userRole, isOpen, onClose }: AdminSidebarProps) => {
  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white shadow-md z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-violet-600">Pawpal</h1>
          <button
            onClick={onClose}
            className="md:hidden text-gray-600 hover:text-gray-800 p-2"
            aria-label="Close menu"
          >
            <FaTimes />
          </button>
        </div>
        <nav className="mt-6">
          <NavLink
            to="/admin-dashboard"
            onClick={() => {
              if (window.innerWidth < 768) {
                onClose();
              }
            }}
            className={({ isActive }) =>
              `flex items-center px-6 py-3 text-gray-700 hover:bg-violet-50 hover:text-violet-600 ${
                isActive ? "bg-violet-50 text-violet-600" : ""
              }`
            }
          >
            <FaHome className="mr-3" />
            Dashboard
          </NavLink>
          {userRole === "admin" && (
            <>
              <NavLink
                to="/admin-dashboard/users"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    onClose();
                  }
                }}
                className={({ isActive }) =>
                  `flex items-center px-6 py-3 text-gray-700 hover:bg-violet-50 hover:text-violet-600 ${
                    isActive ? "bg-violet-50 text-violet-600" : ""
                  }`
                }
              >
                <FaUsers className="mr-3" />
                User Management
              </NavLink>
              <NavLink
                to="/admin-dashboard/vets"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    onClose();
                  }
                }}
                className={({ isActive }) =>
                  `flex items-center px-6 py-3 text-gray-700 hover:bg-violet-50 hover:text-violet-600 ${
                    isActive ? "bg-violet-50 text-violet-600" : ""
                  }`
                }
              >
                <FaUserMd className="mr-3" />
                Vet Management
              </NavLink>
              <NavLink
                to="/admin-dashboard/reports"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    onClose();
                  }
                }}
                className={({ isActive }) =>
                  `flex items-center px-6 py-3 text-gray-700 hover:bg-violet-50 hover:text-violet-600 ${
                    isActive ? "bg-violet-50 text-violet-600" : ""
                  }`
                }
              >
                <FaFileAlt className="mr-3" />
                Reports
              </NavLink>
            </>
          )}
          <NavLink
            to="/admin-dashboard/posts"
            onClick={() => {
              if (window.innerWidth < 768) {
                onClose();
              }
            }}
            className={({ isActive }) =>
              `flex items-center px-6 py-3 text-gray-700 hover:bg-violet-50 hover:text-violet-600 ${
                isActive ? "bg-violet-50 text-violet-600" : ""
              }`
            }
          >
            <FaNewspaper className="mr-3" />
            Post Management
          </NavLink>
          <NavLink
            to="/admin-dashboard/adoptions"
            onClick={() => {
              if (window.innerWidth < 768) {
                onClose();
              }
            }}
            className={({ isActive }) =>
              `flex items-center px-6 py-3 text-gray-700 hover:bg-violet-50 hover:text-violet-600 ${
                isActive ? "bg-violet-50 text-violet-600" : ""
              }`
            }
          >
            <FaPaw className="mr-3" />
            Adoption Management
          </NavLink>
        </nav>
      </div>
    </>
  );
};

export default AdminSidebar;
