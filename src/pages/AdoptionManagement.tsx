import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabase-client";
import { toast } from "react-hot-toast";

interface AdoptedRecord {
  pet_type?: string | null;
  post_id: number;
  post_name: string;
  image_url?: string | null;
  adopted_at?: string | null;
  adopter_id?: string | null;
  adopter_name?: string | null;
  adopter_email?: string | null;
}

export default function AdoptionManagement() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AdoptedRecord[]>([]);

  const fetchAdoptions = useCallback(async () => {
    setLoading(true);
    setRecords([]); // Reset records at start
    try {
      // Try "posts" table first (same as Post Management uses), fallback to "post"
      let allPosts: any[] = [];
      let postsError: any = null;

      // Strategy: Fetch ALL posts and filter client-side for maximum reliability
      // This ensures we catch ALL case variations: "adopted", "Adopted", "ADOPTED", etc.
      // Query WITHOUT order by to avoid 400 errors - we'll sort in JavaScript
      let { data: postsData, error: postsErr } = await supabase
        .from("posts")
        .select("*");

      if (postsErr) {
        console.warn("Error with select(*), trying specific columns:", postsErr);
        // Try with specific columns if select(*) fails
        const result = await supabase
          .from("posts")
          .select("id, name, status, updated_at, created_at, pet_type, image_url");
        postsData = result.data;
        postsErr = result.error;
      }
      
      // Sort in JavaScript if we got data (safer than SQL order by)
      if (postsData && postsData.length > 0) {
        postsData = postsData.sort((a: any, b: any) => {
          const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
          const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
          return dateB - dateA; // Descending order
        });
      }

      if (!postsErr && postsData) {
        allPosts = postsData;
      } else {
        postsError = postsErr;
        console.warn("Primary query failed, trying fallback table:", postsErr);
        // Try "post" table as fallback (without order by)
        const { data: postData, error: postErr } = await supabase
          .from("post")
          .select("*");
        
        // Sort in JavaScript if we got data
        if (postData && postData.length > 0) {
          const sortedPostData = postData.sort((a: any, b: any) => {
            const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
            const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
            return dateB - dateA;
          });
          allPosts = sortedPostData;
        }
        
        if (!postErr && postData && postData.length > 0) {
          // Already sorted above
          postsError = null;
        } else {
          postsError = postErr || postsError;
        }
      }
      
      // Remove duplicates based on post ID (in case fallback queries added duplicates)
      const seenIds = new Set();
      allPosts = allPosts.filter((p: any) => {
        if (seenIds.has(p.id)) {
          return false;
        }
        seenIds.add(p.id);
        return true;
      });

      if (postsError) {
        console.error("Error fetching posts:", postsError);
        toast.error(`Error loading posts: ${postsError.message || "Unknown error"}`);
        // Don't throw - just show empty state
        setRecords([]);
        setLoading(false);
        return;
      }

      // If no posts fetched and we had an error, try direct adopted query as fallback
      if ((!allPosts || allPosts.length === 0) && postsError) {
        console.warn("Main query failed, trying direct adopted status queries...");
        
        // Try querying directly for adopted status (lowercase)
        const { data: adoptedLower, error: errLower } = await supabase
          .from("posts")
          .select("*")
          .eq("status", "adopted");
        if (!errLower && adoptedLower && adoptedLower.length > 0) {
          console.log("Found adopted posts (lowercase):", adoptedLower.length);
          allPosts = adoptedLower;
          postsError = null;
        }
        
        // Try uppercase
        if ((!allPosts || allPosts.length === 0)) {
          const { data: adoptedUpper, error: errUpper } = await supabase
            .from("posts")
            .select("*")
            .eq("status", "ADOPTED");
          if (!errUpper && adoptedUpper && adoptedUpper.length > 0) {
            console.log("Found adopted posts (uppercase):", adoptedUpper.length);
            allPosts = adoptedUpper;
            postsError = null;
          }
        }
        
        // Try capitalized
        if ((!allPosts || allPosts.length === 0)) {
          const { data: adoptedCap, error: errCap } = await supabase
            .from("posts")
            .select("*")
            .eq("status", "Adopted");
          if (!errCap && adoptedCap && adoptedCap.length > 0) {
            console.log("Found adopted posts (capitalized):", adoptedCap.length);
            allPosts = adoptedCap;
            postsError = null;
          }
        }
      }
      
      // If still no posts, log and continue
      if (!allPosts || allPosts.length === 0) {
        console.warn("No posts found in database");
        console.warn("This might be due to:", {
          queryError: postsError,
          hasData: !!postsData,
          dataLength: postsData?.length || 0
        });
        // Don't return early - let the code continue to create empty records array
      }

      // Filter for adopted posts - ULTRA permissive matching to catch ALL variations
      // This will match: "adopted", "Adopted", "ADOPTED", "adopted ", " Adopted", "ADOPTED ", etc.
      const adoptedPosts = (allPosts || []).filter((p: any) => {
        // Handle null/undefined/empty status
        if (!p.status) return false;
        
        // Convert to string and normalize (handles numbers, objects, etc.)
        const statusStr = String(p.status).trim();
        const statusLower = statusStr.toLowerCase();
        
        // Match ANY variation containing "adopted" (case-insensitive)
        // This is the most permissive check - catches all case variations
        const isAdopted = statusLower.includes("adopted");
        
        // Debug log for non-matching statuses that might be adopted
        if (!isAdopted && statusLower.includes("adopt")) {
          console.warn(`Found status "${p.status}" that contains "adopt" but not "adopted" - might need manual review`);
        }
        
        return isAdopted;
      });

      // Log all unique statuses found for debugging
      const uniqueStatuses = [...new Set(allPosts.map((p: any) => p.status))];
      console.log(`Total posts fetched: ${allPosts.length}`);
      console.log(`Unique statuses found:`, uniqueStatuses);
      console.log(`Posts with 'adopted' status (any case): ${adoptedPosts.length}`);
      console.log("All post statuses:", allPosts.map((p: any) => ({ id: p.id, name: p.name, status: p.status, statusType: typeof p.status })));
      console.log("Adopted posts found:", adoptedPosts.map((p: any) => ({ id: p.id, name: p.name, status: p.status })));
      
      // Warn if we see statuses that might be adopted but didn't match
      const suspiciousStatuses = uniqueStatuses.filter((s: any) => {
        const str = String(s || "").toLowerCase();
        return str.includes("adopt") && !str.includes("adopted");
      });
      if (suspiciousStatuses.length > 0) {
        console.warn("Found statuses that might be related to adoption but didn't match:", suspiciousStatuses);
      }
      
      // CRITICAL: Always create records, even if empty - NEVER return early
      // This ensures the UI always updates

      const postIds = adoptedPosts.map((p: any) => p.id).filter(id => id != null);
      
      console.log(`Found ${adoptedPosts.length} adopted posts with IDs:`, postIds);

      // Fetch adoption requests for these posts
      // Priority: Get approved requests first, then fallback to all requests for adopted posts
      let appsData: any[] | null = null;
      let appsError: any = null;
      
      // Only try to fetch adoption requests if we have post IDs
      if (postIds.length > 0) {
        // First, try to get all adoption_requests for these posts (not filtered by status)
        // This ensures we get the data even if status filtering fails
        // Remove order by to avoid 400 errors - we'll sort in JavaScript
        try {
          const res = await supabase
            .from("adoption_requests")
            .select("post_id, requester_id, created_at, updated_at, status")
            .in("post_id", postIds as any);
          
          appsData = res.data as any[] | null;
          appsError = res.error;
          
          // Map requester_id to applicant_id for consistency and sort in JavaScript
          if (appsData && appsData.length > 0) {
            appsData = appsData.map((app: any) => ({
              ...app,
              applicant_id: app.requester_id || app.applicant_id
            }));
            
            // Sort in JavaScript
            appsData = appsData.sort((a: any, b: any) => {
              const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
              const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
              return dateB - dateA; // Descending order
            });
            
            console.log(`Successfully fetched ${appsData.length} adoption requests for ${postIds.length} posts`);
            console.log("Adoption requests sample:", appsData.slice(0, 3).map((a: any) => ({
              post_id: a.post_id,
              requester_id: a.requester_id,
              applicant_id: a.applicant_id,
              status: a.status
            })));
          }
          
          if (appsError) {
            console.warn("Error fetching adoption_requests:", appsError);
          } else if (!appsData || appsData.length === 0) {
            console.warn(`No adoption requests found for posts: ${postIds.join(", ")}`);
          }
        } catch (e) {
          appsError = e;
          console.warn("Exception fetching adoption_requests:", e);
        }

        // If still no data, try adoption_applications as fallback
        if ((appsError || !appsData || appsData.length === 0)) {
          try {
          const res = await supabase
            .from("adoption_applications")
            .select("post_id, applicant_id, created_at, updated_at, status")
            .in("post_id", postIds as any);
          
          appsData = res.data as any[] | null;
          appsError = res.error;
          
          // Sort in JavaScript if we got data
          if (appsData && appsData.length > 0) {
            appsData = appsData.sort((a: any, b: any) => {
              const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
              const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
              return dateB - dateA; // Descending order
            });
          }
            
            if (appsError) {
              console.warn("Error fetching adoption_applications:", appsError);
            }
          } catch (e) {
            appsError = e;
            console.warn("Exception fetching adoption_applications:", e);
          }
        }
      } else {
        console.warn("No valid post IDs found for adopted posts");
      }

      // Log for debugging
      if (appsData && appsData.length > 0) {
        console.log("Found adoption requests/applications:", appsData.length);
      } else {
        console.warn("No adoption requests/applications found for adopted posts:", postIds);
      }

      // Don't throw error if no apps found - we'll handle it gracefully
      // PGRST116 = no rows returned (this is fine, just means no adoption requests found)
      if (appsError && appsError.code !== 'PGRST116') {
        console.warn("Error fetching adoption data (non-critical):", appsError);
        // Continue anyway - we'll show pets without adopter info
      }

      const ACCEPTED_STATUSES = ["approved", "accepted", "adopted", "completed"];

      // Build mapping postId -> approved application
      // CRITICAL: Priority is approved requests - these are the adopters who got approved by the owner
      const appMap = new Map<number, any>();
      
      if (!appsData || appsData.length === 0) {
        console.warn("No adoption requests/applications data available");
      } else {
        // First, collect all approved requests (these are the ones approved by the owner)
        const approvedApps = (appsData || []).filter((app: any) => {
          const normalizedStatus = (app.status || "").toLowerCase().trim();
          return ACCEPTED_STATUSES.includes(normalizedStatus);
        });

        console.log(`Found ${approvedApps.length} approved requests out of ${appsData.length} total`);
        console.log("Approved requests:", approvedApps.map((a: any) => ({ 
          post_id: a.post_id, 
          applicant_id: a.applicant_id, 
          status: a.status 
        })));

        // For each approved app, keep the most recent one per post
        // This ensures we get the adopter who was approved by the owner
        approvedApps.forEach((app: any) => {
          const existing = appMap.get(app.post_id);
          if (!existing) {
            appMap.set(app.post_id, app);
          } else {
            // If there's already an approved request, keep the most recent one
            const existingDate = new Date(existing.updated_at || existing.created_at || 0).getTime();
            const appDate = new Date(app.updated_at || app.created_at || 0).getTime();
            if (appDate > existingDate) {
              appMap.set(app.post_id, app);
            }
          }
        });

        // CRITICAL: If no approved requests found, use MOST RECENT request per post
        // This is important because the pet is adopted, so there MUST be an adopter
        // Even if the status isn't set to "approved", we should still show the adopter
        if (appMap.size === 0) {
          console.warn("No approved requests found, using most recent request per post (pet is adopted, so there must be an adopter)");
          (appsData || []).forEach((app: any) => {
            const existing = appMap.get(app.post_id);
            if (!existing) {
              appMap.set(app.post_id, app);
            } else {
              const existingDate = new Date(existing.updated_at || existing.created_at || 0).getTime();
              const appDate = new Date(app.updated_at || app.created_at || 0).getTime();
              if (appDate > existingDate) {
                appMap.set(app.post_id, app);
              }
            }
          });
          console.log(`After fallback, mapped ${appMap.size} adoption requests to posts`);
        }
      }
      
      console.log(`Mapped ${appMap.size} adoption requests to posts`);
      console.log("Adoption request mapping:", Array.from(appMap.entries()).map(([postId, app]) => ({
        post_id: postId,
        adopter_id: app.applicant_id,
        status: app.status
      })));
      
      console.log(`Mapped ${appMap.size} adoption requests to posts`);

      const adopterIds = Array.from(new Set(Array.from(appMap.values()).map((a: any) => a.applicant_id).filter(Boolean)));
      
      console.log(`Found ${adopterIds.length} unique adopter IDs:`, adopterIds);

      // Build a users map keyed by adopter id -> full name.
      // CRITICAL: This is the adopter who was approved by the owner
      // Preferred source: `profiles` table (has `id, full_name`).
      // Fallback: call RPC `get_user_name(user_id)` if profiles are not available.
      let usersMap: Record<string, any> = {};
      if (adopterIds.length > 0) {
        console.log("Fetching adopter names for IDs:", adopterIds);
        try {
          // Try profiles first (profiles.id references auth.users.id)
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", adopterIds as any);

          if (profilesError) {
            console.warn("Error fetching profiles (non-critical):", profilesError);
            // Continue - we'll try other sources
          }

          if (profilesData && profilesData.length > 0) {
            usersMap = profilesData.reduce((acc: Record<string, any>, u: any) => {
              acc[u.id] = { id: u.id, full_name: u.full_name, email: null };
              return acc;
            }, {} as Record<string, any>);
          }

          // Fetch additional info from users table (for email / fallback names)
          const { data: userTableData } = await supabase
            .from("users")
            .select("user_id, full_name, email")
            .in("user_id", adopterIds as any);

          (userTableData || []).forEach((u) => {
            usersMap[u.user_id] = {
              id: u.user_id,
              full_name: u.full_name || usersMap[u.user_id]?.full_name || "Unknown",
              email: u.email || usersMap[u.user_id]?.email || null,
            };
          });

          // Fallback: call RPC `get_user_name` for ids still missing
          const missingIds = adopterIds.filter((uid) => !usersMap[uid]);
          if (missingIds.length > 0) {
            console.log(`Fetching names for ${missingIds.length} missing adopters via RPC`);
            await Promise.all(
              missingIds.map(async (uid: string) => {
                try {
                  const { data: nameData, error: nameError } = await supabase.rpc("get_user_name", { user_id: uid });
                  if (!nameError && nameData) {
                    usersMap[uid] = {
                      id: uid,
                      full_name: Array.isArray(nameData) ? nameData[0] : nameData,
                      email: null,
                    };
                    console.log(`Found name for adopter ${uid}: ${usersMap[uid].full_name}`);
                  } else {
                    console.warn(`Could not fetch name for adopter ${uid}:`, nameError);
                  }
                } catch (err) {
                  console.warn("RPC get_user_name failed for", uid, err);
                }
              })
            );
          }
          
          // Log final users map
          console.log(`Successfully fetched ${Object.keys(usersMap).length} adopter names:`, 
            Object.entries(usersMap).map(([id, user]) => ({ id, name: user.full_name }))
          );
        } catch (e) {
          // If we fail to fetch user info due to RLS, log and continue
          console.warn("Failed to fetch adopter user records:", e);
        }
      } else {
        console.warn("No adopter IDs found to fetch names for");
      }

      // CRITICAL: ALWAYS create records for ALL adopted posts found
      // Even if there are 0 adopted posts, create empty array to ensure UI updates
      let records: AdoptedRecord[] = [];
      
      try {
        if (adoptedPosts.length > 0) {
          // For each adopted post, try to find the adopter
          records = await Promise.all(adoptedPosts.map(async (p: any) => {
            let app = appMap.get(p.id);
            let adopterId = app?.applicant_id || null;
            let adopter = adopterId ? usersMap[adopterId] : null;
            
            // If we don't have adopter info from the mapping, try direct query as fallback
            if (!adopterId || !adopter) {
              console.log(`Trying direct query for post ${p.id} (${p.name}) adopter...`);
              try {
                // Query adoption_requests directly for this post
                const { data: directRequest, error: directErr } = await supabase
                  .from("adoption_requests")
                  .select("requester_id, status, updated_at, created_at")
                  .eq("post_id", p.id)
                  .order("updated_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                if (!directErr && directRequest && directRequest.requester_id) {
                  adopterId = directRequest.requester_id;
                  console.log(`Found adopter ID ${adopterId} via direct query for post ${p.id}`);
                  
                  // Try to fetch name if we don't have it
                  if (!adopter && adopterId) {
                    // Try profiles
                    const { data: profileData } = await supabase
                      .from("profiles")
                      .select("id, full_name")
                      .eq("id", adopterId)
                      .maybeSingle();
                    
                    if (profileData?.full_name) {
                      adopter = { id: adopterId, full_name: profileData.full_name, email: null };
                    } else {
                      // Try users table
                      const { data: userData } = await supabase
                        .from("users")
                        .select("user_id, full_name, email")
                        .eq("user_id", adopterId)
                        .maybeSingle();
                      
                      if (userData?.full_name) {
                        adopter = { id: adopterId, full_name: userData.full_name, email: userData.email || null };
                      } else {
                        // Try RPC
                        try {
                          const { data: nameData } = await supabase.rpc("get_user_name", { user_id: adopterId });
                          if (nameData) {
                            adopter = { 
                              id: adopterId, 
                              full_name: Array.isArray(nameData) ? nameData[0] : nameData, 
                              email: null 
                            };
                          }
                        } catch (rpcErr) {
                          console.warn(`RPC failed for adopter ${adopterId}:`, rpcErr);
                        }
                      }
                    }
                  }
                }
              } catch (fallbackErr) {
                console.warn(`Fallback query failed for post ${p.id}:`, fallbackErr);
              }
            }
            
            // Use updated_at from the approved request as the adoption date, fallback to post updated_at
            const adoptionDate = app?.updated_at || app?.created_at || p.updated_at || p.created_at || null;
            
            const record: AdoptedRecord = {
              post_id: p.id,
              post_name: p.name || "Unnamed Pet",
              pet_type: p.pet_type || null,
              image_url: p.image_url || null,
              adopted_at: adoptionDate,
              adopter_id: adopterId,
              adopter_name: adopter?.full_name || (adopterId ? "Unknown User" : "Adopter information not available"),
              adopter_email: adopter?.email || null,
            };
            
            // Log for debugging - show adopter information
            if (adopterId) {
              if (adopter?.full_name) {
                console.log(`✓ Post ${p.id} (${p.name}): Adopter "${adopter.full_name}" (ID: ${adopterId})`);
              } else {
                console.warn(`⚠ Post ${p.id} (${p.name}): Found adopter ID ${adopterId} but could not fetch name`);
              }
            } else {
              console.warn(`⚠ Post ${p.id} (${p.name}) is adopted but has no adopter ID found`);
            }
            
            return record;
          }));
        }
      } catch (recordError) {
        console.error("Error creating records:", recordError);
        // Even if there's an error, try to create basic records
        records = adoptedPosts.map((p: any) => ({
          post_id: p.id,
          post_name: p.name || "Unnamed Pet",
          pet_type: p.pet_type || null,
          image_url: p.image_url || null,
          adopted_at: p.updated_at || p.created_at || null,
          adopter_id: null,
          adopter_name: null,
          adopter_email: null,
        }));
      }

      console.log(`Created ${records.length} adoption records`);
      console.log("Final records to display:", records.map(r => ({ id: r.post_id, name: r.post_name, adopter: r.adopter_name })));
      
      // CRITICAL: ALWAYS set records - this ensures the UI updates
      // Force a state update by creating a new array reference
      setRecords(records.length > 0 ? [...records] : []);
      setLoading(false);
      
      // Double-check: Log if records are empty but we found adopted posts
      if (records.length === 0 && adoptedPosts.length > 0) {
        console.error("ERROR: Found adopted posts but created 0 records!", adoptedPosts);
        console.error("Adopted posts details:", adoptedPosts.map(p => ({ id: p.id, name: p.name, status: p.status, statusType: typeof p.status })));
      }
      
      // Final verification log
      if (records.length > 0) {
        console.log("SUCCESS: Records will be displayed in UI", records.length);
      }
    } catch (error: any) {
      console.error("Error fetching adoptions:", error);
      const errorMessage = error?.message || "Unknown error occurred";
      console.error("Full error details:", error);
      toast.error(`Failed to fetch adoption records: ${errorMessage}`);
      setRecords([]); // Set empty array on error
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdoptions();
  }, [fetchAdoptions]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
      </div>
    );
  }

  // Remove duplicate fetching logic: handled above with loading, setRecords

  return (
    <div className="p-6 relative">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pet</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adopter</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adopted On</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {records.map((r) => (
              <tr key={r.post_id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{r.post_name}</div>
                  <div className="text-sm text-gray-500">ID: {r.post_id}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-700">{r.pet_type || '—'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{r.adopter_name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {r.adopted_at ? new Date(r.adopted_at).toLocaleDateString(undefined, {
                    year: 'numeric', month: 'long', day: 'numeric',
                  }) : 'N/A'}
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400">No adoption records found matching your filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
