import { useNavigate, Link } from "react-router-dom";
import { useEffect, useRef, RefObject, useState } from "react";
import {
  FaPaw,
  FaHeart,
  FaHandHoldingHeart,
  FaUserFriends,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { PWAInstallButton } from "../components/PWAInstallButton";
import { supabase } from "../supabase-client";

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const aboutRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);
  const adoptionRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);

  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const redirectAuthenticatedUser = async () => {
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("role, verified")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!userData) {
        navigate("/verify-email", {
          state: {
            pendingApproval: true,
            message:
              "Thankyou for registering, please wait for the verification so you can log in.",
          },
          replace: true,
        });
        return;
      }

      if (userData.role === "admin") {
        navigate("/admin-dashboard", { replace: true });
        return;
      }

      if (userData.role === "vet") {
        navigate("/vet-dashboard", { replace: true });
        return;
      }

      if (userData.role === "user" && userData.verified !== true) {
        navigate("/verify-email", {
          state: {
            pendingApproval: true,
            message:
              "Thankyou for registering, please wait for the verification so you can log in.",
          },
          replace: true,
        });
        return;
      }

      navigate("/home", { replace: true });
    };

    redirectAuthenticatedUser();

    // Add scroll animation observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-in-up");
          }
        });
      },
      { threshold: 0.1 }
    );

    // Observe all sections
    document.querySelectorAll(".scroll-animation").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [user, navigate]);

  const handleGetStarted = () => {
    navigate("/login");
  };

  const scrollToSection = (elementRef: RefObject<HTMLDivElement | null>) => {
    elementRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm fixed w-full z-50">
        <div className="w-full px-2 sm:px-4 md:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <FaPaw className="text-indigo-600 text-3xl mr-2" />
              <span className="font-bold text-2xl text-gray-800 font-['Quicksand']">
                Pawpal
              </span>
            </div>
            {/* Hamburger Icon for mobile */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                className="text-2xl text-indigo-700 focus:outline-none"
                aria-label="Toggle menu"
              >
                {menuOpen ? <FaTimes /> : <FaBars />}
              </button>
            </div>
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={() => scrollToSection(aboutRef)}
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-indigo-600 transition-all duration-200 font-['Poppins']"
              >
                About
              </button>
              <button
                onClick={() => scrollToSection(servicesRef)}
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-indigo-600 transition-all duration-200 font-['Poppins']"
              >
                Services
              </button>
              <button
                onClick={() => scrollToSection(adoptionRef)}
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-indigo-600 transition-all duration-200 font-['Poppins']"
              >
                Adoption
              </button>
              <button
                onClick={() => scrollToSection(contactRef)}
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-indigo-600 transition-all duration-200 font-['Poppins']"
              >
                Contact
              </button>
              <div className="h-6 w-px bg-gray-200"></div>
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-all duration-200 font-['Poppins']"
              >
                Login
              </Link>
              <div className="flex items-center space-x-2">
                <Link
                  to="/signup"
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md font-['Poppins']"
                >
                  Register
                </Link>
              </div>
            </div>
          </div>
          {/* Mobile Dropdown Menu INSIDE NAV, ABSOLUTE POSITIONED */}
          {menuOpen && (
            <div className="md:hidden absolute top-full left-0 w-full z-50 bg-white shadow-lg border-t border-gray-100 animate-fade-in-up">
              <div className="flex flex-col items-center py-4 space-y-2">
                <button
                  onClick={() => { setMenuOpen(false); scrollToSection(aboutRef); }}
                  className="w-full text-left px-6 py-2 rounded-md text-base font-medium text-gray-700 hover:text-indigo-600 transition-all duration-200 font-['Poppins']"
                >
                  About
                </button>
                <button
                  onClick={() => { setMenuOpen(false); scrollToSection(servicesRef); }}
                  className="w-full text-left px-6 py-2 rounded-md text-base font-medium text-gray-700 hover:text-indigo-600 transition-all duration-200 font-['Poppins']"
                >
                  Services
                </button>
                <button
                  onClick={() => { setMenuOpen(false); scrollToSection(adoptionRef); }}
                  className="w-full text-left px-6 py-2 rounded-md text-base font-medium text-gray-700 hover:text-indigo-600 transition-all duration-200 font-['Poppins']"
                >
                  Adoption
                </button>
                <button
                  onClick={() => { setMenuOpen(false); scrollToSection(contactRef); }}
                  className="w-full text-left px-6 py-2 rounded-md text-base font-medium text-gray-700 hover:text-indigo-600 transition-all duration-200 font-['Poppins']"
                >
                  Contact
                </button>
                <div className="h-px w-4/5 bg-gray-200 my-2"></div>
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex items-center w-4/5 justify-center px-4 py-2 rounded-lg text-base font-medium text-indigo-600 hover:text-indigo-700 transition-all duration-200 font-['Poppins']"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex items-center w-4/5 justify-center px-4 py-2 rounded-lg text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md font-['Poppins']"
                >
                  Register
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col items-center justify-center pt-24 md:pt-16 bg-gradient-to-br from-indigo-600/90 to-indigo-800/90 overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.pexels.com/photos/3628100/pexels-photo-3628100.jpeg"
            alt="Background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/60 via-indigo-800/70 to-indigo-700/80"></div>
        </div>
        <div className="relative z-10 text-center px-2 sm:px-4 max-w-full sm:max-w-4xl mx-auto">
          <div className="flex flex-col items-center scroll-animation">
            <div className="text-center mb-8">
              <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold text-white font-['Quicksand'] tracking-wide mb-4 animate-fade-in">
                Adopt l
                <span className="inline-flex items-center justify-center rounded-full bg-emerald-400 w-16 h-16 sm:w-24 sm:h-24 text-2xl sm:text-4xl animate-bounce">
                  5k+
                </span>
                ve,
              </h1>
              <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold text-white font-['Quicksand'] tracking-wide animate-fade-in delay-200">
                F
                <span className="inline-flex items-center justify-center rounded-full bg-rose-400 w-10 h-10 sm:w-16 sm:h-16 text-xl sm:text-3xl animate-bounce delay-300">
                  2k+
                </span>
                ster Happiness
              </h1>
            </div>
            <p className="text-base sm:text-xl text-white/90 mb-6 max-w-xs sm:max-w-2xl animate-fade-in delay-500">
              Your trusted platform for finding loving homes and perfect companions. 
              We connect caring pet owners with responsible adopters through a safe, 
              verified adoption process.
            </p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-8 text-sm sm:text-base animate-fade-in delay-600">
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                <span className="text-emerald-300">✓</span>
                <span className="text-white/90">Verified Pet Profiles</span>
              </div>
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                <span className="text-emerald-300">✓</span>
                <span className="text-white/90">Vet-Approved Listings</span>
              </div>
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                <span className="text-emerald-300">✓</span>
                <span className="text-white/90">Safe Adoption Process</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center animate-fade-in delay-700">
              <button
                onClick={handleGetStarted}
                className="bg-emerald-500 text-white px-6 sm:px-8 py-3 rounded-md text-base sm:text-lg font-medium hover:bg-emerald-600 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Get Started
              </button>
              <PWAInstallButton variant="hero" />
            </div>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div ref={aboutRef} className="py-16 sm:py-24 px-2 sm:px-4 bg-white scroll-animation">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 font-['Quicksand'] mb-4">
              About Us
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-xs sm:max-w-2xl mx-auto">
              We're dedicated to connecting loving homes with pets in need. Our
              mission is to make pet adoption simple, enjoyable, and rewarding.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            <div className="text-center">
              <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaHeart className="text-2xl text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Loving Care</h3>
              <p className="text-gray-600">
                Every pet in our network receives the highest standard of care
                and attention.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaHandHoldingHeart className="text-2xl text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Expert Support</h3>
              <p className="text-gray-600">
                Our team of experts is here to guide you through the adoption
                process.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaUserFriends className="text-2xl text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Community</h3>
              <p className="text-gray-600">
                Join our community of pet lovers and share your adoption
                journey.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Services Section */}
      <div ref={servicesRef} className="py-16 sm:py-24 px-2 sm:px-4 bg-gray-50 scroll-animation">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 font-['Quicksand'] mb-4">
              Our Services
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-xs sm:max-w-2xl mx-auto">
              We provide comprehensive services to ensure successful pet
              adoptions and happy families.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-lg">
              <h3 className="text-2xl font-semibold mb-4">
                Pet Adoption Platform
              </h3>
              <p className="text-gray-600 mb-4">
                Connect with pet owners and find your perfect companion through
                our comprehensive adoption system.
              </p>
              <ul className="space-y-2 text-gray-600">
                <li>• Browse available pets with detailed profiles</li>
                <li>• Submit adoption requests with ease</li>
                <li>• Track adoption status in real-time</li>
                <li>• View pet health information and vaccination status</li>
              </ul>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg">
              <h3 className="text-2xl font-semibold mb-4">Communication Hub</h3>
              <p className="text-gray-600 mb-4">
                Stay connected with pet owners and other adopters through our
                integrated messaging system.
              </p>
              <ul className="space-y-2 text-gray-600">
                <li>• Real-time messaging with pet owners</li>
                <li>• Instant notifications for adoption updates</li>
                <li>• Chat history and conversation management</li>
                <li>• Direct communication for adoption coordination</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Adoption Section */}
      <div
        ref={adoptionRef}
        className="py-16 sm:py-24 px-2 sm:px-4 bg-gradient-to-b from-gray-50 to-gray-100 scroll-animation"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 font-['Quicksand'] mb-4">
              Available for Adoption
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-xs sm:max-w-2xl mx-auto">
              Meet our wonderful pets waiting for their forever homes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Dogs */}
            <div className="rounded-2xl overflow-hidden bg-white p-4 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="relative h-64 rounded-xl overflow-hidden">
                <img
                  src="https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg"
                  alt="Dogs"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-semibold mb-2">Dogs</h3>
                <p className="text-gray-600">Find your loyal companion</p>
              </div>
            </div>

            {/* Cats */}
            <div className="rounded-2xl overflow-hidden bg-white p-4 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="relative h-64 rounded-xl overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
                  alt="Cats"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-semibold mb-2">Cats</h3>
                <p className="text-gray-600">Meet your perfect feline friend</p>
              </div>
            </div>

            {/* Other Pets */}
            <div className="rounded-2xl overflow-hidden bg-white p-4 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="relative h-64 rounded-xl overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1425082661705-1834bfd09dca?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
                  alt="Other Pets"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-semibold mb-2">Other Pets</h3>
                <p className="text-gray-600">Discover unique companions</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div ref={contactRef} className="py-16 sm:py-24 px-2 sm:px-4 bg-white scroll-animation">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 font-['Quicksand'] mb-4">
              Get in Touch
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-xs sm:max-w-2xl mx-auto">
              Have questions about adoption? We're here to help and connect!
            </p>
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 p-4 sm:p-8 rounded-2xl shadow-lg border border-indigo-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
              <div>
                <h3 className="text-2xl font-semibold mb-6 text-indigo-800 font-['Quicksand']">
                  Contact Information
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center space-x-4 p-4 bg-white/70 rounded-xl border border-indigo-100">
                    <div className="bg-indigo-100 p-3 rounded-full">
                      <svg
                        className="w-6 h-6 text-indigo-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-indigo-800">Email</p>
                      <p className="text-gray-600">pawpal.sup@gmailcom</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 p-4 bg-white/70 rounded-xl border border-indigo-100">
                    <div className="bg-indigo-100 p-3 rounded-full">
                      <svg
                        className="w-6 h-6 text-indigo-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-indigo-800">Phone</p>
                      <p className="text-gray-600">+1 (555) 123-4567</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 p-4 bg-white/70 rounded-xl border border-indigo-100">
                    <div className="bg-indigo-100 p-3 rounded-full">
                      <svg
                        className="w-6 h-6 text-indigo-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-indigo-800">Address</p>
                      <p className="text-gray-600">
                        123 Pet Street, Animal City, AC 12345
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-semibold mb-6 text-indigo-800 font-['Quicksand']">
                  Follow Us
                </h3>
                <p className="text-gray-600 mb-6">
                  Stay connected with our community and get the latest updates
                  on pet adoptions, success stories, and community events.
                </p>
                <div className="space-y-4">
                  <a
                    href="#"
                    className="flex items-center space-x-4 p-4 bg-white/70 rounded-xl border border-indigo-100 hover:bg-white hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="bg-blue-100 p-3 rounded-full group-hover:bg-blue-200 transition-colors">
                      <svg
                        className="w-6 h-6 text-blue-600"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-indigo-800">Twitter</p>
                      <p className="text-gray-600">@PawpalOfficial</p>
                    </div>
                  </a>

                  <a
                    href="#"
                    className="flex items-center space-x-4 p-4 bg-white/70 rounded-xl border border-indigo-100 hover:bg-white hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="bg-pink-100 p-3 rounded-full group-hover:bg-pink-200 transition-colors">
                      <svg
                        className="w-6 h-6 text-pink-600"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-indigo-800">Pinterest</p>
                      <p className="text-gray-600">Pawpal Pets</p>
                    </div>
                  </a>

                  <a
                    href="#"
                    className="flex items-center space-x-4 p-4 bg-white/70 rounded-xl border border-indigo-100 hover:bg-white hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="bg-red-100 p-3 rounded-full group-hover:bg-red-200 transition-colors">
                      <svg
                        className="w-6 h-6 text-red-600"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-indigo-800">YouTube</p>
                      <p className="text-gray-600">Pawpal Channel</p>
                    </div>
                  </a>

                  <a
                    href="https://www.facebook.com/PawPaI2025"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-4 p-4 bg-white/70 rounded-xl border border-indigo-100 hover:bg-white hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="bg-green-100 p-3 rounded-full group-hover:bg-green-200 transition-colors">
                      <svg
                        className="w-6 h-6 text-green-600"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-indigo-800">Facebook</p>
                      <p className="text-gray-600">Pawpal Community</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
