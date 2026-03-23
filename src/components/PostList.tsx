import { useState, useEffect } from "react";
import { supabase } from "../supabase-client";
import { Link, useNavigate } from "react-router-dom";
import { FaPaw, FaArrowRight } from "react-icons/fa";
import { MdPets } from "react-icons/md";

export interface Post {
  id: number;
  title: string;
  content: string;
  created_at: string;
  auth_users_id: string;
  image_url?: string;
  additional_photos?: string[];
  age?: number;
  breed?: string;
  pet_type?: "Dog" | "Cat" | "Rabbit" | "Bird" | "Guinea Pig" | "Hamster";
  vaccination_status?: boolean;
  location?: string;
  size?: "Small" | "Medium" | "Large" | "Extra Large";
  temperament?: string[];
  health_info?: string;
  status?: "Available" | "Pending" | "Adopted";
  name?: string;
  user_id?: string;
  avatar_url?: string;
  community_id?: number;
  comments?: { id: number }[];
  likes?: { id: number }[];
  owner_name?: string;
  owner_avatar?: string;
  owner_first_name?: string | null;
  owner_last_name?: string | null;
}

interface PostListProps {
  posts?: Post[];
}

export const PostList: React.FC<PostListProps> = ({ posts: initialPosts }) => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>(initialPosts || []);
  const [loading, setLoading] = useState(!initialPosts);

  useEffect(() => {
    if (!initialPosts) {
      fetchPosts();
    } else {
      // If posts are passed in from parent, enrich them with owner info before setting
      const enrich = async () => {
        try {
          const postsData = initialPosts as any[];
          const userIds = Array.from(new Set(postsData.map((p: any) => p.user_id || p.auth_users_id).filter(Boolean)));
          let usersMap: Record<string, any> = {};
          if (userIds.length > 0) {
            try {
              // Prefer `profiles` table
              const { data: profilesData, error: profilesError } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url")
                .in("id", userIds as any);
              if (profilesError) throw profilesError;
              if (profilesData && profilesData.length > 0) {
                usersMap = profilesData.reduce((acc: Record<string, any>, u: any) => {
                  acc[u.id] = u;
                  return acc;
                }, {} as Record<string, any>);
              } else {
                // Fallback: call RPC per id (get_user_name)
                await Promise.all(
                  userIds.map(async (uid: string) => {
                    try {
                      const { data: nameData, error: nameError } = await supabase.rpc("get_user_name", { user_id: uid });
                      if (!nameError && nameData) {
                        usersMap[uid] = { id: uid, full_name: Array.isArray(nameData) ? nameData[0] : nameData };
                      }
                    } catch (err) {
                      console.warn("RPC get_user_name failed for", uid, err);
                    }
                  })
                );
              }
            } catch (err) {
              console.warn("Failed to fetch profiles for posts enrichment:", err);
            }
          }

          const enriched = postsData.map((post: any) => {
            const uid = post.user_id || post.auth_users_id || post.user?.id;
            const owner = (uid && usersMap[uid]) || null;
            // Prefer owner_name from post (newly saved), fallback to fetched owner full_name
            const fullName = post.owner_name || owner?.full_name || owner?.fullName || null;
            let firstName = null as string | null;
            let lastName = null as string | null;
            if (fullName) {
              const parts = String(fullName).trim().split(/\s+/);
              firstName = parts.shift() || null;
              lastName = parts.length > 0 ? parts.join(" ") : null;
            }
            return {
              ...post,
              like_count: post.like_count ?? 0,
              comment_count: post.comment_count ?? 0,
              owner_name: fullName,
              owner_first_name: firstName,
              owner_last_name: lastName,
              owner_avatar: owner?.avatar_url || owner?.avatar || post.avatar_url || null,
            } as any;
          });
          setPosts(enriched);
        } catch (error) {
          console.error("Error enriching initial posts:", error);
          setPosts(initialPosts);
        }
      };
      enrich();
    }
  }, [initialPosts]);

  const fetchPosts = async () => {
    try {
      console.log("Fetching posts...");
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("Posts data:", postsData);
      console.log("Posts error:", postsError);

      if (postsError) throw postsError;

      if (!postsData) {
        setPosts([]);
        return;
      }

      // Fetch owner profiles for the posts (by user_id)
      const userIds = Array.from(new Set(postsData.map((p: any) => p.user_id || p.auth_users_id).filter(Boolean)));
      let usersMap: Record<string, any> = {};
      if (userIds.length > 0) {
        try {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", userIds as any);
          if (profilesError) {
            console.warn("Error fetching profiles:", profilesError);
          }
          if (profilesData && profilesData.length > 0) {
            usersMap = profilesData.reduce((acc: Record<string, any>, u: any) => {
              acc[u.id] = u;
              return acc;
            }, {} as Record<string, any>);
          } else {
            // Fallback to RPC per id
            await Promise.all(
              userIds.map(async (uid: string) => {
                try {
                  const { data: nameData, error: nameError } = await supabase.rpc("get_user_name", { user_id: uid });
                  if (!nameError && nameData) {
                    usersMap[uid] = { id: uid, full_name: Array.isArray(nameData) ? nameData[0] : nameData };
                  }
                } catch (err) {
                  console.warn("RPC get_user_name failed for", uid, err);
                }
              })
            );
          }
        } catch (err) {
          console.error("Unexpected error fetching profiles:", err);
        }
      }

      // Transform the data to include counts
      const enrichedPosts = postsData.map((post: any) => {
        const uid = post.user_id || post.auth_users_id || post.user?.id;
        const owner = (uid && usersMap[uid]) || null;
        // Prefer owner_name from post (persisted at creation), then profiles.full_name, then RPC fallback
        const fullName = post.owner_name || owner?.full_name || owner?.fullName || null;
        let firstName = null as string | null;
        let lastName = null as string | null;
        if (fullName) {
          const parts = String(fullName).trim().split(/\s+/);
          firstName = parts.shift() || null;
          lastName = parts.length > 0 ? parts.join(" ") : null;
        }
        return {
          ...post,
          like_count: 0,
          comment_count: 0,
          owner_name: fullName,
          owner_first_name: firstName,
          owner_last_name: lastName,
          owner_avatar: owner?.avatar_url || owner?.avatar || post.avatar_url || null,
        } as any;
      });

      console.log("Enriched posts:", enrichedPosts);
      setPosts(enrichedPosts);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  };

  

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4  border-opacity-100 border-r-4 border-violet-300 border-opacity-50"></div>
      </div>
    );
  }

  return (
    <div className="w-full grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
      {posts.length === 0 && !loading ? (
        <div className="text-center text-violet-600 py-8 sm:py-10 col-span-full font-['Poppins']">
          <FaPaw className="text-4xl sm:text-5xl mx-auto mb-3 sm:mb-4 text-violet-300" />
          <p className="text-lg sm:text-xl mb-2">No posts found</p>
          <p className="text-violet-500 mb-3 sm:mb-4 text-sm sm:text-base ">
            Be the first pet owner to create a post!  
          </p>
          <Link
            to="/create"
            className="bg-gradient-to-r from-violet-500 to-blue-500 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-medium hover:from-violet-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-300 shadow-md inline-flex items-center gap-2 text-sm sm:text-base"
          >
            <FaPaw /> Create Post
          </Link>
        </div>
      ) : (
        posts.map((post, index) => (
            <div
              key={post.id}
              className="group rounded-2xl overflow-hidden bg-white shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out hover:-translate-y-1"
              style={{
                opacity: 0,
                animation: `fade-in-up 0.5s ease-out forwards`,
                animationDelay: `${index * 100}ms`,
              }}
            >
              <Link to={`/post/${post.id}`} className="block h-full">
                <div className="w-full h-full flex flex-col">
                  {/* Image Section */}
                  <div className="relative overflow-hidden">
                    <img
                      src={post.image_url || "/default-pet.jpg"}
                      alt={post.name || "Pet"}
                      className="w-full object-cover h-52 transition-transform duration-500 ease-in-out group-hover:scale-110"
                    />
                  </div>

                  {/* Content Section */}
                  <div className="p-4 flex-1 flex flex-col">
                    {/* Name and Breed */}
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 font-['Quicksand'] truncate">
                          {post.name || "Unnamed Pet"}
                        </h3>

                        {/* Owner name: prefer split first/last, fallback to owner_name */}
                        {(post.owner_first_name || post.owner_name) && (
                          <p className="text-sm text-violet-600 font-['Poppins'] flex items-center truncate">
                            <span className="text-xs text-gray-500">Posted by</span>
                            <span
                              className="ml-2 font-medium text-violet-700 hover:text-violet-900 hover:underline cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                navigate(`/user/${(post as any).user_id || (post as any).auth_users_id}`);
                              }}
                            >
                              {post.owner_first_name
                                ? `${post.owner_first_name}${post.owner_last_name ? ' ' + post.owner_last_name : ''}`
                                : post.owner_name}
                            </span>
                          </p>
                        )}

                        {(!post.owner_first_name && !post.owner_name) && post.breed && (
                          <p className="text-sm text-gray-500 font-['Poppins'] flex items-center truncate">
                            <MdPets className="mr-2 flex-shrink-0 text-gray-400" />
                            {post.pet_type ? `${post.pet_type} • ${post.breed}` : post.breed}
                          </p>
                        )}
                    </div>

                    {/* Quick Facts Bar */}
                    <div className="flex justify-around text-center my-4 py-2 border-y border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500 font-['Poppins'] uppercase tracking-wider">
                          Age
                        </p>
                        <p className="font-bold text-gray-700 text-sm sm:text-base">
                          {post.age !== undefined ? `${post.age} yrs` : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-['Poppins'] uppercase tracking-wider">
                          Size
                        </p>
                        <p className="font-bold text-gray-700 text-sm sm:text-base">
                          {post.size === 'Small'
                            ? 'Small: 1 – 10 kg'
                            : post.size === 'Medium'
                            ? 'Medium: 11 – 25 kg'
                            : post.size === 'Large'
                            ? 'Large: 26 – 44 kg'
                            : post.size === 'Extra Large'
                            ? 'Extra Large (XL): 45+ kg'
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-['Poppins'] uppercase tracking-wider">
                          Location
                        </p>
                        <p
                          className="font-bold text-gray-700 truncate text-sm sm:text-base"
                          title={post.location}
                        >
                          {post.location || "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Description Preview */}
                    {post.content && (
                      <p className="text-sm text-gray-600 line-clamp-3 font-['Poppins'] flex-grow">
                        {post.content}
                      </p>
                    )}

                    {/* Footer with action */}
                    <div className="mt-4 pt-4 border-t border-gray-100 text-right">
                      <span className="inline-flex items-center font-semibold text-violet-600 group-hover:text-blue-500 transition-colors duration-300 font-['Poppins'] text-sm">
                        View Details
                        <FaArrowRight className="ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))
      )}
    </div>
  );
};
