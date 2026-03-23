import { CommunityList } from "../components/CommunityList";
import { FaPaw } from "react-icons/fa";
import { useEffect, useState } from "react";

export const CommunitiesPage = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    // Add scroll animation for elements
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -100px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.reveal');
    animatedElements.forEach(el => observer.observe(el));

    return () => {
      animatedElements.forEach(el => observer.unobserve(el));
    };
  }, []);

  return (
    <div className="pt-20 min-h-screen bg-gradient-to-b from-violet-50/50 via-blue-50/30 to-white px-4">
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
      
      <div className={`relative z-10 max-w-6xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="text-center mb-10 reveal">
          <span className="bg-violet-100 text-violet-800 px-4 py-1 rounded-full text-sm font-medium font-['Poppins'] mb-4 inline-block">Join a Community</span>
          <h2 className="text-4xl md:text-5xl font-bold text-violet-800 font-['Quicksand']">
            Pet Communities
      </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-violet-500 to-blue-500 mx-auto mt-6"></div>
          <p className="text-gray-600 mt-4 max-w-xl mx-auto font-['Poppins']">
            Connect with fellow pet lovers and share experiences in our friendly communities
          </p>
        </div>
        
        <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-md p-6 reveal">
      <CommunityList />
        </div>
      </div>
      
      {/* Add animation style for floating paws */}
      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0) rotate(var(--rotation)); }
            50% { transform: translateY(-20px) rotate(var(--rotation)); }
          }
          .animate-float {
            --rotation: 0deg;
            animation: float 8s ease-in-out infinite;
          }
          .reveal {
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.6s ease-out;
          }
          .reveal-visible {
          opacity: 1;
            transform: translateY(0);
          }
        `}
      </style>
    </div>
  );
};
 