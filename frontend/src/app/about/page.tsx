"use client";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <div className="container mx-auto p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-8">About NeverFall</h1>
          
          {/* Hero Section */}
          <div className="hero bg-base-200 rounded-lg mb-12">
            <div className="hero-content text-center">
              <div className="max-w-md">
                <h2 className="text-3xl font-bold mb-4">Your Ultimate Fashion Destination</h2>
                <p className="text-lg">
                  Discover the latest trends in footwear and fashion with NeverFall. 
                  We bring you premium quality products at unbeatable prices.
                </p>
              </div>
            </div>
          </div>

          {/* Mission Section */}
          <div className="card bg-base-100 shadow mb-8">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Our Mission</h2>
              <p className="text-lg leading-relaxed">
                At NeverFall, we believe that everyone deserves access to high-quality, 
                stylish footwear that doesn't break the bank. Our mission is to provide 
                a seamless shopping experience with a wide range of products, excellent 
                customer service, and fast, reliable delivery.
              </p>
            </div>
          </div>

          {/* Values Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card bg-base-100 shadow">
              <div className="card-body text-center">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="card-title justify-center">Quality First</h3>
                <p>We carefully curate our products to ensure the highest quality standards.</p>
              </div>
            </div>
            <div className="card bg-base-100 shadow">
              <div className="card-body text-center">
                <div className="text-4xl mb-4">💡</div>
                <h3 className="card-title justify-center">Innovation</h3>
                <p>We stay ahead of trends to bring you the latest in fashion and technology.</p>
              </div>
            </div>
            <div className="card bg-base-100 shadow">
              <div className="card-body text-center">
                <div className="text-4xl mb-4">❤️</div>
                <h3 className="card-title justify-center">Customer Care</h3>
                <p>Your satisfaction is our priority. We're here to help every step of the way.</p>
              </div>
            </div>
          </div>

          {/* Story Section */}
          <div className="card bg-base-100 shadow mb-8">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Our Story</h2>
              <div className="prose max-w-none">
                <p className="text-lg leading-relaxed mb-4">
                  Founded with a passion for fashion and a commitment to quality, NeverFall 
                  started as a small team of fashion enthusiasts who wanted to make premium 
                  footwear accessible to everyone. What began as a simple idea has grown 
                  into a trusted platform serving thousands of customers worldwide.
                </p>
                <p className="text-lg leading-relaxed">
                  Today, we continue to expand our collection while maintaining our core 
                  values of quality, affordability, and exceptional customer service. 
                  Every product in our catalog is carefully selected to meet our high 
                  standards, ensuring that our customers always get the best value for 
                  their money.
                </p>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="card bg-base-100 shadow mb-8">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-6">Why Choose NeverFall?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="badge badge-primary badge-lg">✓</div>
                    <div>
                      <h3 className="font-semibold">Free Shipping</h3>
                      <p className="text-sm text-gray-600">On orders over ₹999</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="badge badge-primary badge-lg">✓</div>
                    <div>
                      <h3 className="font-semibold">Easy Returns</h3>
                      <p className="text-sm text-gray-600">30-day return policy</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="badge badge-primary badge-lg">✓</div>
                    <div>
                      <h3 className="font-semibold">Secure Payment</h3>
                      <p className="text-sm text-gray-600">100% secure transactions</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="badge badge-primary badge-lg">✓</div>
                    <div>
                      <h3 className="font-semibold">24/7 Support</h3>
                      <p className="text-sm text-gray-600">Always here to help</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="badge badge-primary badge-lg">✓</div>
                    <div>
                      <h3 className="font-semibold">Latest Trends</h3>
                      <p className="text-sm text-gray-600">Stay ahead of fashion</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="badge badge-primary badge-lg">✓</div>
                    <div>
                      <h3 className="font-semibold">Quality Guarantee</h3>
                      <p className="text-sm text-gray-600">Premium materials only</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Team Section */}
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-6">Meet Our Team</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="avatar placeholder mb-4">
                    <div className="bg-neutral text-neutral-content rounded-full w-24">
                      <span className="text-3xl">👨‍💼</span>
                    </div>
                  </div>
                  <h3 className="font-semibold">John Doe</h3>
                  <p className="text-sm text-gray-600">Founder & CEO</p>
                </div>
                <div className="text-center">
                  <div className="avatar placeholder mb-4">
                    <div className="bg-neutral text-neutral-content rounded-full w-24">
                      <span className="text-3xl">👩‍💼</span>
                    </div>
                  </div>
                  <h3 className="font-semibold">Jane Smith</h3>
                  <p className="text-sm text-gray-600">Head of Design</p>
                </div>
                <div className="text-center">
                  <div className="avatar placeholder mb-4">
                    <div className="bg-neutral text-neutral-content rounded-full w-24">
                      <span className="text-3xl">👨‍💻</span>
                    </div>
                  </div>
                  <h3 className="font-semibold">Mike Johnson</h3>
                  <p className="text-sm text-gray-600">Tech Lead</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
