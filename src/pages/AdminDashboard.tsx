import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabase-client";
import { toast } from "react-hot-toast";
import AdminSidebar from "../components/AdminSidebar";
import CreateVetAccount from "../components/CreateVetAccount";
import AdoptionManagement from "./AdoptionManagement";
import { Routes, Route, useNavigate } from "react-router-dom";
import { FaTimes, FaBars } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { SignOutConfirmationModal } from "../components/SignOutConfirmationModal";
import React from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Post {
  id: number;
  name: string;
  status: string;
  user_id?: string;
  auth_users_id?: string;
  created_at: string;
  ownerName?: string;
  image_url?: string;
  additional_photos?: string[];
  content?: string;
  age?: number;
  breed?: string;
  vaccination_status?: boolean;
  location?: string;
  size?: string;
  temperament?: string[];
  health_info?: string;
}

interface User {
  user_id: string;
  full_name: string;
  role: string;
  verified: boolean;
  created_at: string;
  email?: string;
  avatar_url?: string;
  adoption_validation?: { [key: string]: string };
}

interface DashboardStats {
  totalPosts: number;
  pendingPosts: number;
  totalUsers: number;
  totalVets: number;
  adoptedPets: number;
  rejectedPets: number;
  approvedPets: number;
  pendingPets: number;
  availablePets: number;
  recentActivity: {
    type: string;
    description: string;
    timestamp: string;
  }[];
}

const DashboardNavbar = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const handleSignOutClick = () => {
    setShowSignOutModal(true);
  };

  const handleSignOutConfirm = () => {
    signOut();
    navigate("/login");
  };

  return (
    <>
      <nav className="fixed top-0 left-0 w-full h-16 bg-violet-700 text-white flex items-center justify-between px-4 md:px-8 shadow z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="md:hidden text-white hover:text-violet-200 p-2"
            aria-label="Toggle menu"
          >
            <FaBars className="text-xl" />
          </button>
          <div className="font-bold text-lg tracking-wide">Pawpal Admin</div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <span className="font-medium text-sm md:text-base hidden sm:inline">
            {user?.user_metadata?.full_name || user?.email || "Admin"}
          </span>
          <button
            onClick={handleSignOutClick}
            className="bg-white text-violet-700 px-3 md:px-4 py-2 rounded font-semibold hover:bg-violet-100 transition-colors text-sm md:text-base"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Sign Out Confirmation Modal */}
      <SignOutConfirmationModal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={handleSignOutConfirm}
        userName={user?.user_metadata?.full_name || user?.email?.split("@")[0]}
      />
    </>
  );
};

const DashboardHome = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalPosts: 0,
    pendingPosts: 0,
    totalUsers: 0,
    totalVets: 0,
    adoptedPets: 0,
    rejectedPets: 0,
    approvedPets: 0,
    pendingPets: 0,
    availablePets: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [visitCount, setVisitCount] = useState<number | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          console.log("No session found, redirecting to login");
          navigate("/login");
          return;
        }
        console.log("Checking user access for user:", session.user.id);
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role")
          .eq("user_id", session.user.id)
          .single();
        if (userError) {
          console.error("Error fetching user data:", userError);
          toast.error("Failed to verify user access");
          navigate("/login");
          return;
        }
        if (!userData) {
          console.log("User data not found, redirecting to home");
          navigate("/home");
          return;
        }
        setUserRole(userData.role);
        fetchStats(userData.role);
        // Fetch current visit count if admin
        if (userData.role === "admin") {
          try {
            const { data: currentCount, error: currentError } = await supabase.rpc(
              "get_visit_count"
            );

            if (!currentError && currentCount !== null && currentCount !== undefined) {
              setVisitCount(Number(currentCount));
            } else if (currentError) {
              console.error("Error fetching visit count:", currentError);
            }
          } catch (error) {
            console.error("Error with visit counter:", error);
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
        toast.error("Authentication error");
        navigate("/login");
      }
    };

    checkAuth();
  }, [navigate]);

  const fetchStats = async (role: string) => {
    try {
      console.log("Fetching stats for role:", role);

      // Get posts data based on role
      let postsQuery = supabase.from("posts").select("*");
      if (role === "vet") {
        postsQuery = postsQuery.eq("status", "pending_vet_review");
      } else if (role === "user") {
        postsQuery = postsQuery.eq(
          "user_id",
          (await supabase.auth.getUser()).data.user?.id
        );
      }

      const { data: postsData, error: postsError } = await postsQuery
        .order("created_at", { ascending: false })
        .limit(5);

      console.log("Posts data:", postsData);
      console.log("Posts error:", postsError);

      // Get counts based on role
      let totalPosts = 0;
      let pendingPosts = 0;
      let totalUsers = 0;
      let totalVets = 0;
      let adoptedPets = 0;
      let rejectedPets = 0;
      let approvedPets = 0;
      let pendingPets = 0;
      let availablePets = 0;

      if (role === "admin") {
        const [
          { count: postsCount },
          { count: pendingCount },
          { count: usersCount },
          { count: vetsCount },
          { count: adoptedCount },
          { count: rejectedCount },
          { count: approvedCount },
          { count: pendingStatusCount },
          { count: availableCount },
        ] = await Promise.all([
          supabase.from("posts").select("*", { count: "exact", head: true }),
          supabase
            .from("posts")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending_vet_review"),
          supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("role", "user"),
          supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("role", "vet"),
          supabase
            .from("posts")
            .select("*", { count: "exact", head: true })
            .in("status", ["adopted", "Adopted"]),
          supabase
            .from("posts")
            .select("*", { count: "exact", head: true })
            .in("status", ["rejected", "Rejected"]),
          supabase
            .from("posts")
            .select("*", { count: "exact", head: true })
            .in("status", ["approved", "Approved"]),
          supabase
            .from("posts")
            .select("*", { count: "exact", head: true })
            .in("status", ["pending", "Pending"]),
          supabase
            .from("posts")
            .select("*", { count: "exact", head: true })
            .in("status", ["available", "Available"]),
        ]);

        totalPosts = postsCount || 0;
        pendingPosts = pendingCount || 0;
        totalUsers = usersCount || 0;
        totalVets = vetsCount || 0;
        adoptedPets = adoptedCount || 0;
        rejectedPets = rejectedCount || 0;
        approvedPets = approvedCount || 0;
        pendingPets = pendingStatusCount || 0;
        availablePets = availableCount || 0;
      } else if (role === "vet") {
        const { count } = await supabase
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending_vet_review");
        pendingPosts = count || 0;
      } else if (role === "user") {
        const { count } = await supabase
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id);
        totalPosts = count || 0;
      }

      // Get user details for posts
      const userIds =
        postsData
          ?.map((post) => post.user_id || post.auth_users_id)
          .filter(Boolean) || [];
      const { data: postUsers } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const userMap = new Map(
        postUsers?.map((user) => [user.id, user.full_name]) || []
      );

      const recentActivity = [
        ...(postsData?.map((post) => ({
          type: "post",
          description: `New post created: ${post.name} by ${
            userMap.get(post.user_id || post.auth_users_id) || "Unknown"
          }`,
          timestamp: post.created_at,
        })) || []),
      ]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, 5);

      setStats({
        totalPosts,
        pendingPosts,
        totalUsers,
        totalVets,
        adoptedPets,
        rejectedPets,
        approvedPets,
        pendingPets,
        availablePets,
        recentActivity,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Failed to fetch dashboard statistics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>
      {userRole === "admin" && (
        <div className="mb-6 relative overflow-hidden bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 rounded-xl shadow-lg">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white/90 text-sm font-medium mb-1">Total Website Visits</h3>
                <p className="text-4xl font-bold text-white">
                  {visitCount !== null ? visitCount.toLocaleString() : (
                    <span className="inline-block animate-pulse">...</span>
                  )}
                </p>
                <p className="text-white/70 text-xs mt-1">Updated in real-time</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-white/80">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-sm font-medium">Live</span>
            </div>
          </div>
        </div>
      )}
      {userRole === "admin" && (
        <>
          {/* Charts Section */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">Pet Status Distribution (Bar Chart)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { name: "Adopted", value: stats.adoptedPets },
                      { name: "Approved", value: stats.approvedPets },
                      { name: "Pending", value: stats.pendingPets },
                      { name: "Rejected", value: stats.rejectedPets },
                      { name: "Available", value: stats.availablePets },
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8B5CF6" name="Number of Pets" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">Pet Status Distribution (Pie Chart)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Adopted", value: stats.adoptedPets, color: "#10B981" },
                        { name: "Approved", value: stats.approvedPets, color: "#3B82F6" },
                        { name: "Pending", value: stats.pendingPets, color: "#F59E0B" },
                        { name: "Rejected", value: stats.rejectedPets, color: "#EF4444" },
                        { name: "Available", value: stats.availablePets, color: "#8B5CF6" },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ percent }) => {
                        if (percent && percent > 0.05) {
                          return `${(percent * 100).toFixed(0)}%`;
                        }
                        return "";
                      }}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        { name: "Adopted", value: stats.adoptedPets, color: "#10B981" },
                        { name: "Approved", value: stats.approvedPets, color: "#3B82F6" },
                        { name: "Pending", value: stats.pendingPets, color: "#F59E0B" },
                        { name: "Rejected", value: stats.rejectedPets, color: "#EF4444" },
                        { name: "Available", value: stats.availablePets, color: "#8B5CF6" },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, _name: string) => {
                        const total = stats.adoptedPets + stats.approvedPets + stats.pendingPets + stats.rejectedPets + stats.availablePets;
                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                        return `${value} (${percentage}%)`;
                      }}
                      contentStyle={{ padding: '8px', borderRadius: '8px' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Overall Statistics Chart */}
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">Overall Dashboard Statistics</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { name: "Total Posts", value: stats.totalPosts },
                    { name: "Total Users", value: stats.totalUsers },
                    { name: "Total Vets", value: stats.totalVets },
                    { name: "Pending Reviews", value: stats.pendingPosts },
                  ]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8B5CF6" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {stats.recentActivity.map((activity, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="font-medium">{activity.description}</p>
                <p className="text-sm text-gray-500">
                  {new Date(activity.timestamp).toLocaleString()}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm ${
                  activity.type === "post"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {activity.type === "post" ? "Post" : "User"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      console.log("Fetching users...");

      // First get users from the users table with a more permissive query
      // Filter out declined users - admins should not see declined users
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*") // Select all columns
        .order("created_at", { ascending: false });
      
      // Filter out declined users on the client side
      const nonDeclinedUsers = (usersData || []).filter((user: any) => !user.declined || user.declined === false);

      console.log("Raw users data:", usersData);
      console.log("Users error:", usersError);

      if (usersError) {
        console.error("Error fetching users:", usersError);
        throw usersError;
      }

      if (!nonDeclinedUsers || nonDeclinedUsers.length === 0) {
        console.log("No users found in the users table");
        setUsers([]);
        setLoading(false);
        return;
      }

      // Get user profiles for additional information (optional - profiles might not exist)
      const userIds = nonDeclinedUsers.map((user: any) => user.user_id);
      console.log("User IDs to fetch profiles for:", userIds);

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      console.log("Raw profiles data:", profilesData);
      console.log("Profiles error:", profilesError);

      // Don't throw error if profiles don't exist - it's optional
      // if (profilesError) {
      //   console.error("Error fetching profiles:", profilesError);
      //   throw profilesError;
      // }

      // Create a map of user profiles
      const profileMap = new Map(
        profilesData?.map((profile) => [profile.id, profile]) || []
      );
      console.log("Profile map:", Object.fromEntries(profileMap));

      // Combine user data with profile data
      // adoption_validation comes from users table, not profiles
      const combinedUsers = nonDeclinedUsers.map((user: any) => {
        const profile = profileMap.get(user.user_id);
        console.log(`Processing user ${user.user_id}:`, {
          userData: user,
          profileData: profile,
        });
        return {
          ...user,
          full_name: profile?.full_name || user.full_name || "Unknown",
          email: profile?.email || user.email || "N/A",
          adoption_validation: user.adoption_validation || null,
        };
      });

      console.log("Combined users data:", combinedUsers);

      // Apply filter if needed
      const filteredUsers =
        filter === "all"
          ? combinedUsers
          : combinedUsers.filter((user) => user.role === filter);

      console.log("Final filtered users:", filteredUsers);
      setUsers(filteredUsers);
    } catch (error) {
      console.error("Error in fetchUsers:", error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("User role updated successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error updating user role:", error);
      toast.error("Failed to update user role");
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">User Management</h2>
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded ${
              filter === "all"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            All Users
          </button>
          <button
            onClick={() => setFilter("user")}
            className={`px-4 py-2 rounded ${
              filter === "user"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Regular Users
          </button>
          <button
            onClick={() => setFilter("vet")}
            className={`px-4 py-2 rounded ${
              filter === "vet"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Veterinarians
          </button>
          <button
            onClick={() => setFilter("admin")}
            className={`px-4 py-2 rounded ${
              filter === "admin"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Administrators
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              {/* Assessment and Actions columns removed for admin */}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <React.Fragment key={user.user_id}>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.full_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.user_id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleRoleChange(user.user_id, e.target.value)
                      }
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="user">User</option>
                      <option value="vet">Veterinarian</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.verified
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {user.verified ? "Verified" : "Unverified"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  {/* Assessment and Action columns removed for admin */}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const VetManagement = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [vets, setVets] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVets = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all users with role 'vet'
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .eq("role", "vet")
        .order("created_at", { ascending: false });
      if (usersError) throw usersError;

      // Fetch profiles for these vets
      const userIds = usersData?.map((user) => user.user_id) || [];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      // Map profiles to users
      const profileMap = new Map(
        profilesData?.map((profile) => [profile.id, profile]) || []
      );
      const combinedVets =
        usersData?.map((user) => ({
          ...user,
          full_name: profileMap.get(user.user_id)?.full_name || "Unknown",
        })) || [];
      setVets(combinedVets);
    } catch (error) {
      console.error("Error fetching vets:", error);
      toast.error("Failed to fetch veterinarians");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVets();
  }, [fetchVets]);

  const handleVerificationToggle = async (
    userId: string,
    currentVerified: boolean
  ) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ verified: !currentVerified })
        .eq("user_id", userId);
      if (error) throw error;
      toast.success(
        `Vet ${!currentVerified ? "verified" : "unverified"} successfully`
      );
      fetchVets();
    } catch (error) {
      console.error("Error toggling vet verification:", error);
      toast.error("Failed to update vet verification status");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Vet Management</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-violet-600 text-white px-4 py-2 rounded-md hover:bg-violet-700"
        >
          {showCreateForm ? "Cancel" : "Create New Vet Account"}
        </button>
      </div>

      {showCreateForm && (
        <div className="mb-6">
          <CreateVetAccount
            onSuccess={() => {
              setShowCreateForm(false);
              fetchVets();
            }}
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vets.map((vet) => (
              <tr key={vet.user_id}>
                <td className="px-6 py-4 whitespace-nowrap">{vet.full_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      vet.verified
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {vet.verified ? "Verified" : "Pending"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(vet.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() =>
                      handleVerificationToggle(vet.user_id, vet.verified)
                    }
                    className={`text-${
                      vet.verified ? "yellow" : "green"
                    }-600 hover:text-${vet.verified ? "yellow" : "green"}-900`}
                  >
                    {vet.verified ? "Unverify" : "Verify"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PostManagement = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      console.log("Fetching posts...");

      let query = supabase.from("posts").select("*");
      if (filter !== "all") {
        if (filter === "adopted") {
          query = query.in("status", ["adopted", "Adopted"]);
        } else if (filter === "approved") {
          query = query.in("status", ["approved", "Approved"]);
        } else if (filter === "pending") {
          query = query.in("status", ["pending", "Pending"]);
        } else if (filter === "rejected") {
          query = query.in("status", ["rejected", "Rejected"]);
        } else {
          query = query.eq("status", filter);
        }
      }
      const { data: postsData, error: postsError } = await query;

      console.log("Posts data:", postsData);
      console.log("Posts error:", postsError);

      if (postsError) {
        throw postsError;
      }

      // Get user details for posts
      const userIds =
        postsData
          ?.map((post) => post.user_id || post.auth_users_id)
          .filter(Boolean) || [];
      const { data: postUsers } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const userMap = new Map(
        postUsers?.map((user) => [user.id, user.full_name]) || []
      );

      // Combine posts with user data; prefer stored `owner_name` on post
      const postsWithUsers =
        postsData?.map((post) => ({
          ...post,
          ownerName:
            post.owner_name || userMap.get(post.user_id || post.auth_users_id) || "Unknown",
        })) || [];

      setPosts(postsWithUsers);
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast.error("Failed to fetch posts");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePostAction = async (
    postId: number,
    action: "approve" | "reject" | "remove"
  ) => {
    try {
      if (action === "remove") {
        const { error } = await supabase.from("posts").delete().eq("id", postId); // <-- FIXED
        if (error) throw error;
        toast.success("Post removed successfully");
      } else {
        const { error } = await supabase
          .from("posts") // <-- FIXED
          .update({ status: action === "approve" ? "approved" : "rejected" })
          .eq("id", postId);
        if (error) throw error;
        toast.success(`Post ${action}d successfully`);
      }
      fetchPosts();
    } catch (error) {
      console.error("Error updating post:", error);
      toast.error("Failed to update post");
    }
  };

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPost(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Post Management</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border p-2 rounded-md"
        >
          <option value="all">All Posts</option>
          <option value="pending">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="adopted">Adopted</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {posts.map((post) => (
              <tr
                key={post.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => handlePostClick(post)}
              >
                <td className="px-6 py-4 whitespace-nowrap">{post.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {post.ownerName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      post.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : post.status === "rejected"
                        ? "bg-red-100 text-red-800"
                        : post.status === "adopted"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {post.status.replace(/_/g, " ").toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(post.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap space-x-2">
                  {post.status === "pending" && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePostAction(post.id, "approve");
                        }}
                        className="bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600"
                      >
                        Approve
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePostAction(post.id, "reject");
                        }}
                        className="bg-yellow-500 text-white px-3 py-1 rounded-md text-sm hover:bg-yellow-600"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePostAction(post.id, "remove");
                    }}
                    className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Post Details Modal */}
      {showModal && selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedPost.name}</h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            {/* Image Gallery */}
            <div className="mb-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {selectedPost.image_url && (
                  <div className="relative aspect-square">
                    <img
                      src={selectedPost.image_url}
                      alt={selectedPost.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                )}
                {selectedPost.additional_photos?.map((photo, index) => (
                  <div key={index} className="relative aspect-square">
                    <img
                      src={photo}
                      alt={`${selectedPost.name} - Photo ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Post Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Basic Information
                </h3>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Owner:</span>{" "}
                    {selectedPost.ownerName}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span>{" "}
                    {selectedPost.status}
                  </p>
                  <p>
                    <span className="font-medium">Created:</span>{" "}
                    {new Date(selectedPost.created_at).toLocaleString()}
                  </p>
                  {selectedPost.age && (
                    <p>
                      <span className="font-medium">Age:</span>{" "}
                      {selectedPost.age} years
                    </p>
                  )}
                  {selectedPost.breed && (
                    <p>
                      <span className="font-medium">Breed:</span>{" "}
                      {selectedPost.breed}
                    </p>
                  )}
                  {selectedPost.size && (
                    <p>
                      <span className="font-medium">Size:</span>{" "}
                      {selectedPost.size}
                    </p>
                  )}
                  {selectedPost.location && (
                    <p>
                      <span className="font-medium">Location:</span>{" "}
                      {selectedPost.location}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Additional Details
                </h3>
                <div className="space-y-2">
                  {selectedPost.content && (
                    <div>
                      <p className="font-medium">Description:</p>
                      <p className="text-gray-600">{selectedPost.content}</p>
                    </div>
                  )}
                  {selectedPost.temperament &&
                    selectedPost.temperament.length > 0 && (
                      <div>
                        <p className="font-medium">Temperament:</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedPost.temperament.map((trait, index) => (
                            <span
                              key={index}
                              className="bg-violet-100 text-violet-800 px-2 py-1 rounded-full text-sm"
                            >
                              {trait}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  {selectedPost.health_info && (
                    <div>
                      <p className="font-medium">Health Information:</p>
                      <p className="text-gray-600">
                        {selectedPost.health_info}
                      </p>
                    </div>
                  )}
                  <p>
                    <span className="font-medium">Vaccination Status:</span>{" "}
                    {selectedPost.vaccination_status
                      ? "Vaccinated"
                      : "Not Vaccinated"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          console.log("No session found, redirecting to login");
          navigate("/login");
          return;
        }

        console.log("Checking user access for user:", session.user.id);

        // First check the users table
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        if (userError) {
          console.error("Error fetching user data:", userError);
          toast.error("Failed to verify user access");
          navigate("/login");
          return;
        }

        console.log("User data:", userData);

        if (!userData) {
          console.log("User data not found, redirecting to home");
          navigate("/home");
          return;
        }

        // Set the user role
        setUserRole(userData.role);
        console.log("User role set to:", userData.role);
        setLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        toast.error("Authentication error");
        navigate("/login");
      }
    };

    checkAuth();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  // Debug log to check user role
  console.log("Current user role:", userRole);

  return (
    <>
      <DashboardNavbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex min-h-screen bg-gray-50 pt-16">
        <AdminSidebar 
          userRole={userRole} 
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 md:ml-64">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            {userRole === "admin" && (
              <>
                <Route path="/users" element={<UserManagement />} />
                <Route path="/vets" element={<VetManagement />} />
              </>
            )}
            <Route path="/posts" element={<PostManagement />} />
            <Route path="/adoptions" element={
              (userRole === "admin" || userRole === "vet") ? (
                // lazy load page via import to avoid circular imports
                <AdoptionManagement />
              ) : (
                <PostManagement />
              )
            } />
          </Routes>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
