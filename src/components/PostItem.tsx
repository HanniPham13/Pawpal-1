import { Link, useNavigate } from "react-router-dom";
import { Post } from "./PostList";
import {
  FaPaw,
  FaMapMarkerAlt,
  FaSyringe,
  FaRuler,
  FaHeartbeat,
  FaCalendarAlt,
} from "react-icons/fa";
import { MdPets } from "react-icons/md";

interface Props {
  post: Post;
}

export const PostItem = ({ post }: Props) => {
  const navigate = useNavigate();
  

  // Function to extract vaccination proof URL from health_info
  const extractVaccinationProof = (healthInfo: string) => {
    if (!healthInfo) return null;
    const match = healthInfo.match(/Vaccination Proof:\s+(https?:\/\/\S+)/i);
    return match ? match[1] : null;
  };

  // Function to get clean health info without the vaccination proof URL
  const getCleanHealthInfo = (healthInfo: string) => {
    if (!healthInfo) return "";
    return healthInfo
      .replace(/Vaccination Proof:\s+https?:\/\/\S+/gi, "")
      .trim();
  };

  const vaccinationProofUrl = post.health_info
    ? extractVaccinationProof(post.health_info)
    : null;
  const cleanHealthInfo = post.health_info
    ? getCleanHealthInfo(post.health_info)
    : "";

  return (
    <div className="group">
      <Link to={`/post/${post.id}`} className="block">
        <div className="w-96 bg-white/90 backdrop-blur-md rounded-2xl overflow-hidden transition-all duration-300 shadow-md hover:shadow-lg group-hover:translate-y-[-5px] border border-violet-100">
          {/* Header: Avatar and Title */}
          <div className="px-5 pt-5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {post.avatar_url ? (
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-400 to-blue-400 rounded-full opacity-75 blur-sm"></div>
                  <img
                    src={post.avatar_url}
                    alt="User Avatar"
                    className="w-10 h-10 rounded-full object-cover relative border-2 border-white"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-400 to-blue-400 flex items-center justify-center">
                  <FaPaw className="text-white" />
                </div>
              )}
              <div className="flex flex-col">
                <div className="text-xl leading-snug font-bold text-violet-800 font-['Quicksand']">
                  {post.name}
                </div>
                <div className="text-sm text-violet-600 font-['Poppins'] flex items-center">
                  {post.owner_first_name || post.owner_name ? (
                    <>
                      <span className="text-xs text-gray-500">Posted by</span>
                      <span
                        className="ml-2 font-medium text-violet-700 hover:text-violet-900 hover:underline cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/user/${post.user_id || post.auth_users_id}`);
                        }}
                      >
                        {post.owner_first_name
                          ? `${post.owner_first_name}${post.owner_last_name ? ' ' + post.owner_last_name : ''}`
                          : post.owner_name}
                      </span>
                    </>
                  ) : (
                    post.breed && (
                      <>
                        <MdPets className="mr-1 text-violet-400" />
                        {post.breed}
                      </>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Image Banner */}
          <div className="mt-4 relative overflow-hidden">
            <img
              src={post.image_url}
              alt={post.name}
              className="w-full object-cover h-52 group-hover:scale-105 transition-transform duration-500"
            />
          </div>

          {/* Pet Details */}
          <div className="p-5 space-y-3">
            {/* Location and Age */}
            <div className="flex justify-between text-sm font-['Poppins']">
              {post.location && (
                <span className="flex items-center text-violet-700">
                  <FaMapMarkerAlt className="mr-1 text-violet-500" />
                  {post.location}
                </span>
              )}
              {post.age && (
                <span className="flex items-center text-violet-700">
                  <FaCalendarAlt className="mr-1 text-violet-500" />
                  {post.age} months
                </span>
              )}
            </div>

            {/* Pet Type / Breed, Size and Vaccination Status */}
            <div className="flex justify-between text-sm font-['Poppins']">
              {post.breed && (
                <span className="flex items-center text-violet-700 mr-2 truncate">
                  <MdPets className="mr-1 text-violet-500" />
                  {post.pet_type ? `${post.pet_type} • ${post.breed}` : post.breed}
                </span>
              )}
              {post.size && (
                <span className="flex items-center text-violet-700">
                  <FaRuler className="mr-1 text-violet-500" />
                  {post.size === 'Small'
                    ? 'Small: 1 – 10 kg'
                    : post.size === 'Medium'
                    ? 'Medium: 11 – 25 kg'
                    : post.size === 'Large'
                    ? 'Large: 26 – 44 kg'
                    : post.size === 'Extra Large'
                    ? 'Extra Large (XL): 45+ kg'
                    : post.size}
                </span>
              )}
              {post.vaccination_status !== undefined && (
                <span className="flex items-center text-violet-700">
                  <FaSyringe className="mr-1 text-violet-500" />
                  {post.vaccination_status ? "Vaccinated" : "Not vaccinated"}
                </span>
              )}
            </div>

            {/* Health Info Preview */}
            {cleanHealthInfo && (
              <div className="mt-2 text-sm">
                <div className="flex items-center text-purple-300 mb-1">
                  <FaHeartbeat className="mr-1" />
                  <span>Health Information</span>
                </div>
                <p className="text-gray-400 line-clamp-2">{cleanHealthInfo}</p>
              </div>
            )}

            {/* Vaccination Proof Preview */}
            {vaccinationProofUrl && post.vaccination_status && (
              <div className="mt-2">
                <div className="flex items-center text-purple-300 mb-1 text-sm">
                  <FaSyringe className="mr-1" />
                  <span>Vaccination Proof</span>
                </div>
                <img
                  src={vaccinationProofUrl}
                  alt="Vaccination Proof"
                  className="w-full h-20 object-cover rounded-lg"
                />
              </div>
            )}

            {/* Temperament */}
            {post.temperament && post.temperament.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {post.temperament.map((trait, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-violet-100 rounded-full text-xs text-violet-700 font-['Poppins']"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            )}

            {/* Description Preview */}
            {post.content && (
              <p className="text-sm text-gray-600 mt-3 line-clamp-2 font-['Poppins']">
                {post.content}
              </p>
            )}
          </div>

          {/* Interaction Stats */}
          <div className="flex justify-between items-center mt-2 px-5 pb-5">
            <span className="text-violet-600 text-sm font-medium hover:text-violet-800 transition-colors font-['Poppins']">
              View Details →
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
};
