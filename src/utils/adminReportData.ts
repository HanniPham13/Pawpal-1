import { supabase } from "../supabase-client";

export interface PetSummary {
  id: number;
  name: string;
  pet_type?: string | null;
  breed?: string | null;
  status: string;
  location?: string | null;
  created_at: string;
}

export interface PetOwnerReport {
  owner_id: string;
  owner_name: string;
  owner_email: string;
  joined_at?: string | null;
  pets: PetSummary[];
}

export interface AdoptedPetRecord {
  post_id: number;
  post_name: string;
  pet_type?: string | null;
  breed?: string | null;
  adopted_at?: string | null;
  owner_name?: string | null;
}

export interface AdopterReport {
  adopter_id: string;
  adopter_name: string;
  adopter_email?: string | null;
  adopted_pets: AdoptedPetRecord[];
}

export interface AdminReportData {
  generatedAt: string;
  summary: {
    totalOwners: number;
    totalPetsListed: number;
    totalAdopters: number;
    totalAdoptedPets: number;
  };
  petOwners: PetOwnerReport[];
  adopters: AdopterReport[];
}

const ACCEPTED_STATUSES = ["approved", "accepted", "adopted", "completed"];

function isAdoptedStatus(status: unknown): boolean {
  if (!status) return false;
  return String(status).trim().toLowerCase().includes("adopted");
}

async function fetchAllPosts(): Promise<any[]> {
  let { data, error } = await supabase.from("posts").select("*");

  if (error) {
    const fallback = await supabase.from("post").select("*");
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  return data || [];
}

async function buildUserMap(userIds: string[]): Promise<Record<string, { full_name: string; email: string }>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const map: Record<string, { full_name: string; email: string }> = {};

  if (uniqueIds.length === 0) return map;

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", uniqueIds);

  (profilesData || []).forEach((p) => {
    map[p.id] = {
      full_name: p.full_name || "Unknown",
      email: p.email || "N/A",
    };
  });

  const { data: usersData } = await supabase
    .from("users")
    .select("user_id, full_name, email, created_at")
    .in("user_id", uniqueIds);

  (usersData || []).forEach((u) => {
    map[u.user_id] = {
      full_name: u.full_name || map[u.user_id]?.full_name || "Unknown",
      email: u.email || map[u.user_id]?.email || "N/A",
    };
  });

  const missingIds = uniqueIds.filter((id) => !map[id]?.full_name || map[id].full_name === "Unknown");
  await Promise.all(
    missingIds.map(async (uid) => {
      try {
        const { data: nameData } = await supabase.rpc("get_user_name", { user_id: uid });
        if (nameData) {
          map[uid] = {
            full_name: Array.isArray(nameData) ? nameData[0] : String(nameData),
            email: map[uid]?.email || "N/A",
          };
        }
      } catch {
        // Non-critical fallback
      }
    })
  );

  return map;
}

export async function fetchAdminReportData(): Promise<AdminReportData> {
  const allPosts = await fetchAllPosts();

  const ownerIds = allPosts
    .map((p) => p.user_id || p.auth_users_id)
    .filter(Boolean) as string[];

  const userMap = await buildUserMap(ownerIds);

  const { data: ownerUsersData } = await supabase
    .from("users")
    .select("user_id, created_at")
    .in("user_id", [...new Set(ownerIds)]);

  const joinedMap = new Map(
    (ownerUsersData || []).map((u) => [u.user_id, u.created_at])
  );

  const ownersMap = new Map<string, PetOwnerReport>();

  allPosts.forEach((post) => {
    const ownerId = post.user_id || post.auth_users_id;
    if (!ownerId) return;

    const userInfo = userMap[ownerId];
    const ownerName = post.owner_name || userInfo?.full_name || "Unknown";
    const ownerEmail = userInfo?.email || "N/A";

    if (!ownersMap.has(ownerId)) {
      ownersMap.set(ownerId, {
        owner_id: ownerId,
        owner_name: ownerName,
        owner_email: ownerEmail,
        joined_at: joinedMap.get(ownerId) || null,
        pets: [],
      });
    }

    ownersMap.get(ownerId)!.pets.push({
      id: post.id,
      name: post.name || "Unnamed Pet",
      pet_type: post.pet_type,
      breed: post.breed,
      status: post.status || "Unknown",
      location: post.location,
      created_at: post.created_at,
    });
  });

  const petOwners = Array.from(ownersMap.values()).sort((a, b) =>
    a.owner_name.localeCompare(b.owner_name)
  );

  const adoptedPosts = allPosts.filter((p) => isAdoptedStatus(p.status));
  const postIds = adoptedPosts.map((p) => p.id).filter((id) => id != null);

  let appsData: any[] = [];
  if (postIds.length > 0) {
    const { data: requestsData } = await supabase
      .from("adoption_requests")
      .select("post_id, requester_id, created_at, updated_at, status")
      .in("post_id", postIds);

    appsData = (requestsData || []).map((app) => ({
      ...app,
      applicant_id: app.requester_id,
    }));

    if (appsData.length === 0) {
      const { data: applicationsData } = await supabase
        .from("adoption_applications")
        .select("post_id, applicant_id, created_at, updated_at, status")
        .in("post_id", postIds);
      appsData = applicationsData || [];
    }
  }

  const appMap = new Map<number, any>();
  const approvedApps = appsData.filter((app) =>
    ACCEPTED_STATUSES.includes((app.status || "").toLowerCase().trim())
  );

  const appsToUse = approvedApps.length > 0 ? approvedApps : appsData;

  appsToUse.forEach((app) => {
    const existing = appMap.get(app.post_id);
    if (!existing) {
      appMap.set(app.post_id, app);
      return;
    }
    const existingDate = new Date(existing.updated_at || existing.created_at || 0).getTime();
    const appDate = new Date(app.updated_at || app.created_at || 0).getTime();
    if (appDate > existingDate) {
      appMap.set(app.post_id, app);
    }
  });

  const adopterIds = [
    ...new Set(
      Array.from(appMap.values())
        .map((a) => a.applicant_id || a.requester_id)
        .filter(Boolean)
    ),
  ] as string[];

  const adopterUserMap = await buildUserMap(adopterIds);
  const adoptersMap = new Map<string, AdopterReport>();

  adoptedPosts.forEach((post) => {
    const app = appMap.get(post.id);
    const adopterId = app?.applicant_id || app?.requester_id || null;
    const ownerId = post.user_id || post.auth_users_id;
    const ownerName =
      post.owner_name ||
      (ownerId ? userMap[ownerId]?.full_name : null) ||
      "Unknown";

    const adoptedPet: AdoptedPetRecord = {
      post_id: post.id,
      post_name: post.name || "Unnamed Pet",
      pet_type: post.pet_type,
      breed: post.breed,
      adopted_at: app?.updated_at || app?.created_at || post.updated_at || post.created_at,
      owner_name: ownerName,
    };

    if (adopterId) {
      const adopterInfo = adopterUserMap[adopterId];
      if (!adoptersMap.has(adopterId)) {
        adoptersMap.set(adopterId, {
          adopter_id: adopterId,
          adopter_name: adopterInfo?.full_name || "Unknown User",
          adopter_email: adopterInfo?.email || null,
          adopted_pets: [],
        });
      }
      adoptersMap.get(adopterId)!.adopted_pets.push(adoptedPet);
    } else {
      const unknownKey = "unlinked-adopter";
      if (!adoptersMap.has(unknownKey)) {
        adoptersMap.set(unknownKey, {
          adopter_id: unknownKey,
          adopter_name: "Adopter information not available",
          adopter_email: null,
          adopted_pets: [],
        });
      }
      adoptersMap.get(unknownKey)!.adopted_pets.push(adoptedPet);
    }
  });

  const adopters = Array.from(adoptersMap.values())
    .filter((a) => a.adopter_id !== "unlinked-adopter" || a.adopted_pets.length > 0)
    .sort((a, b) => a.adopter_name.localeCompare(b.adopter_name));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalOwners: petOwners.length,
      totalPetsListed: allPosts.length,
      totalAdopters: adopters.filter((a) => a.adopter_id !== "unlinked-adopter").length,
      totalAdoptedPets: adoptedPosts.length,
    },
    petOwners,
    adopters,
  };
}

export function formatReportDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
