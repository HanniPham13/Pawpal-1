import { PostList } from "../components/PostList";
import {
  FaPaw,
  FaMapMarkerAlt,
  FaRuler,
  FaFilter,
  FaTimes,
} from "react-icons/fa";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabase-client";
import { Post } from "../components/PostList";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const BREEDS_MAP: Record<string, string[]> = {
  Dog: [
    "Golden Retriever", "Labrador", "Bulldog", "Beagle", "Poodle", "German Shepherd", "Shih Tzu", "Dachshund", "Other"
  ],
  Cat: [
    "Persian", "Maine Coon", "Siamese", "British Shorthair", "Sphynx", "Ragdoll", "Bengal", "Other"
  ],
  Rabbit: [
    "Netherland Dwarf", "Mini Lop", "Holland Lop", "Lionhead", "Flemish Giant", "Dutch", "Other"
  ],
  Bird: [
    "Parakeet", "Cockatiel", "Canary", "Finch", "Parrot", "Lovebird", "Other"
  ],
  "Guinea Pig": [
    "American", "Abyssinian", "Peruvian", "Silkie", "Teddy", "Texel", "Other"
  ],
  Hamster: [
    "Syrian", "Dwarf Campbell", "Winter White", "Roborovski", "Other"
  ],
};

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filters, setFilters] = useState({
    petType: "",
    breed: "",
    location: "",
    size: "",
    ageMin: "",
    ageMax: "",
    vaccinationProof: "", // "all", "with", "without"
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const enforceVerifiedUser = async () => {
      if (!user) return;

      const { data: userRow } = await supabase
        .from("users")
        .select("role, verified")
        .eq("user_id", user.id)
        .maybeSingle();

      // Treat missing profile rows for regular users as pending until vet/admin approves.
      const metaRole = user.user_metadata?.role || "user";

      if (!userRow && metaRole === "user") {
        await supabase.auth.signOut();
        localStorage.removeItem("userRole");
        navigate("/verify-email", {
          replace: true,
          state: {
            pendingApproval: true,
            message:
              "Thankyou for registering, please wait for the verification so you can log in.",
          },
        });
        return;
      }

      if (userRow && userRow.role === "user" && userRow.verified !== true) {
        await supabase.auth.signOut();
        localStorage.removeItem("userRole");
        navigate("/verify-email", {
          replace: true,
          state: {
            pendingApproval: true,
            message:
              "Thankyou for registering, please wait for the verification so you can log in.",
          },
        });
      }
    };

    enforceVerifiedUser();
  }, [user, navigate]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("posts")
        .select("*")
        .eq("status", "approved");

      if (filters.breed) {
        query = query.ilike("breed", `%${filters.breed}%`);
      }
      if (filters.location) {
        query = query.ilike("location", `%${filters.location}%`);
      }
      if (filters.petType) {
        query = query.eq("pet_type", filters.petType);
      }
      if (filters.size) {
        query = query.eq("size", filters.size);
      }
      if (filters.ageMin) {
        query = query.gte("age", filters.ageMin);
      }
      if (filters.ageMax) {
        query = query.lte("age", filters.ageMax);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      // Vaccination Proof filter (client-side, since health_info is a text field)
      let filteredPosts = data || [];
      if (filters.vaccinationProof === "with") {
        filteredPosts = filteredPosts.filter(
          (post) =>
            typeof post.health_info === "string" &&
            /Vaccination Proof:\s+https?:\/\/\S+/i.test(post.health_info)
        );
      }
      if (filters.vaccinationProof === "without") {
        filteredPosts = filteredPosts.filter(
          (post) =>
            !post.health_info ||
            post.health_info === "EMPTY" ||
            !/Vaccination Proof:\s+https?:\/\/\S+/i.test(post.health_info)
        );
      }

      setPosts(filteredPosts);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchPosts();
    }, 500); // Debounce search

    return () => {
      clearTimeout(handler);
    };
  }, [fetchPosts]);

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="pt-16 sm:pt-20 min-h-screen bg-gradient-to-b from-violet-50/50 via-blue-50/30 to-white px-3 sm:px-4">
      {/* Animated Paw Prints Background */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-5">
        {Array.from({ length: 15 }).map((_, i) => (
          <FaPaw
            key={i}
            className="absolute text-violet-600 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              fontSize: `${Math.random() * 2 + 1}rem`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${Math.random() * 10 + 15}s`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        ))}
      </div>

      {/* Filter Toggle Button (Mobile) */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-40 p-4 bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-full shadow-lg hover:scale-110 active:scale-100 transition-transform"
        aria-label="Open filters"
      >
        <FaFilter className="w-5 h-5" />
      </button>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div>
          <div
            className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
          {/* Sidebar - now rendered above overlay with higher z-index */}
          <aside
            className={`fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-white/95 rounded-l-2xl shadow-2xl z-50 p-6 transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
            lg:sticky lg:h-auto lg:shadow-md lg:rounded-2xl lg:top-24 lg:self-start`}
            style={{ boxShadow: '0 6px 32px 0 rgba(80,64,187,0.15)' }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center mb-4 lg:mb-0">
              <h3 className="text-xl font-bold text-violet-800 font-['Quicksand']">
                Find Your Pal
              </h3>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-2 -mr-2 text-slate-600 hover:text-slate-800"
                aria-label="Close filters"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 lg:mt-4 overflow-y-auto max-h-[90vh] pr-1">
              {/* Filter by Pet Type */}
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-2">
                  Pet Type
                </label>
                <select
                  name="petType"
                  value={filters.petType}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition appearance-none"
                >
                  <option value="">Any Type</option>
                  <option value="Dog">Dog</option>
                  <option value="Cat">Cat</option>
                  <option value="Rabbit">Rabbit</option>
                  <option value="Bird">Bird</option>
                  <option value="Guinea Pig">Guinea Pig</option>
                  <option value="Hamster">Hamster</option>
                </select>
              </div>
              {/* Search by Breed */}
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-2">
                  Breed
                </label>
                {(filters.petType && BREEDS_MAP[filters.petType]) ? (
                  <select
                    name="breed"
                    value={filters.breed}
                    onChange={handleFilterChange}
                    className="w-full px-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition appearance-none"
                  >
                    <option value="">Any Breed</option>
                    {BREEDS_MAP[filters.petType].map((breed) => (
                      <option value={breed} key={breed}>{breed}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="breed"
                    value=""
                    placeholder="Select a pet type first"
                    disabled
                    className="w-full px-4 py-2 bg-gray-100 border-none rounded-xl text-violet-400"
                    readOnly
                  />
                )}
              </div>

              {/* Search by Location */}
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-2">
                  Location
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-violet-400">
                    <FaMapMarkerAlt />
                  </span>
                  <input
                    type="text"
                    name="location"
                    value={filters.location}
                    onChange={handleFilterChange}
                    className="w-full pl-10 pr-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition"
                    placeholder="e.g., New York"
                  />
                </div>
              </div>

              {/* Filter by Size */}
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-2">
                  Size
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-violet-400">
                    <FaRuler />
                  </span>
                  <select
                    name="size"
                    value={filters.size}
                    onChange={handleFilterChange}
                    className="w-full pl-10 pr-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition appearance-none"
                  >
                    <option value="">Any Size</option>
                    <option value="Small">Small</option>
                    <option value="Medium">Medium</option>
                    <option value="Large">Large</option>
                    <option value="Extra Large">Extra Large</option>
                  </select>
                </div>
              </div>

              {/* Filter by Age */}
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-2">
                  Age (years)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="ageMin"
                    value={filters.ageMin}
                    onChange={handleFilterChange}
                    className="w-full px-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition"
                    placeholder="Min"
                    min="0"
                  />
                  <input
                    type="number"
                    name="ageMax"
                    value={filters.ageMax}
                    onChange={handleFilterChange}
                    className="w-full px-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition"
                    placeholder="Max"
                    min="0"
                  />
                </div>
              </div>

              {/* Filter by Vaccination Proof */}
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-2">
                  Vaccination Proof
                </label>
                <select
                  name="vaccinationProof"
                  value={filters.vaccinationProof}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition appearance-none"
                >
                  <option value="">All</option>
                  <option value="with">With Proof</option>
                  <option value="without">Without Proof</option>
                </select>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Desktop Layout */}
      <div className="lg:grid lg:grid-cols-[288px_1fr] lg:gap-8">
        {/* Sidebar for desktop only! */}
        <aside
          className="hidden lg:block bg-white/10 backdrop-blur-sm shadow-md rounded-2xl sticky h-auto top-24 self-start w-72 max-w-[85vw] p-6"
        >
          {/* Filter Controls (same as above, repeat or extract component if possible) */}
          <div className="flex justify-between items-center mb-4 lg:mb-0">
            <h3 className="text-xl font-bold text-violet-800 font-['Quicksand']">
              Find Your Pal
            </h3>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 -mr-2 text-slate-600 hover:text-slate-800"
              aria-label="Close filters"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 lg:mt-4 overflow-y-auto max-h-[90vh] pr-1">
            {/* Filter by Pet Type */}
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-2">
                Pet Type
              </label>
              <select
                name="petType"
                value={filters.petType}
                onChange={handleFilterChange}
                className="w-full px-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition appearance-none"
              >
                <option value="">Any Type</option>
                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
                <option value="Rabbit">Rabbit</option>
                <option value="Bird">Bird</option>
                <option value="Guinea Pig">Guinea Pig</option>
                <option value="Hamster">Hamster</option>
              </select>
            </div>
            {/* Search by Breed */}
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-2">
                Breed
              </label>
              {(filters.petType && BREEDS_MAP[filters.petType]) ? (
                <select
                  name="breed"
                  value={filters.breed}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition appearance-none"
                >
                  <option value="">Any Breed</option>
                  {BREEDS_MAP[filters.petType].map((breed) => (
                    <option value={breed} key={breed}>{breed}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="breed"
                  value=""
                  placeholder="Select a pet type first"
                  disabled
                  className="w-full px-4 py-2 bg-gray-100 border-none rounded-xl text-violet-400"
                  readOnly
                />
              )}
            </div>

            {/* Search by Location */}
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-2">
                Location
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-violet-400">
                  <FaMapMarkerAlt />
                </span>
                <input
                  type="text"
                  name="location"
                  value={filters.location}
                  onChange={handleFilterChange}
                  className="w-full pl-10 pr-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition"
                  placeholder="e.g., New York"
                />
              </div>
            </div>

            {/* Filter by Size */}
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-2">
                Size
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-violet-400">
                  <FaRuler />
                </span>
                <select
                  name="size"
                  value={filters.size}
                  onChange={handleFilterChange}
                  className="w-full pl-10 pr-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition appearance-none"
                >
                  <option value="">Any Size</option>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                  <option value="Extra Large">Extra Large</option>
                </select>
              </div>
            </div>

            {/* Filter by Age */}
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-2">
                Age (years)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="ageMin"
                  value={filters.ageMin}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition"
                  placeholder="Min"
                  min="0"
                />
                <input
                  type="number"
                  name="ageMax"
                  value={filters.ageMax}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition"
                  placeholder="Max"
                  min="0"
                />
              </div>
            </div>

            {/* Filter by Vaccination Proof */}
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-2">
                Vaccination Proof
              </label>
              <select
                name="vaccinationProof"
                value={filters.vaccinationProof}
                onChange={handleFilterChange}
                className="w-full px-4 py-2 bg-violet-50 border-none rounded-xl text-violet-800 focus:ring-2 focus:ring-violet-400 transition appearance-none"
              >
                <option value="">All</option>
                <option value="with">With Proof</option>
                <option value="without">Without Proof</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="relative z-20">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-md p-3 sm:p-4 md:p-6 w-full">
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-violet-500"></div>
              </div>
            ) : (
              <PostList posts={posts} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Home;
