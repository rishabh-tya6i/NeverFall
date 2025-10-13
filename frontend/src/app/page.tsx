import Footer from "./components/Footer";
import Navbar from "./components/Navbar";

export default function Home() {

  const featuredProducts = [
    {
      id: 1,
      name: 'Nike Air Max 270',
      href: '#',
      imageSrc: 'https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/e07987ed-96da-422f-beb4-8e9c7e120eb2/W+AIR+MAX+270.png',
      imageAlt: "Nike Air Max 270 in black and white",
      price: '$150.00',
      color: 'Black/White',
    },
    {
      id: 2,
      name: 'Adidas Ultraboost 21',
      href: '#',
      imageSrc: 'https://assets.adidas.com/images/w_600,f_auto,q_auto/e3a7db18925d4728809baafc0106b761_9366/Ultraboost_20_Shoes_Black_EF1043_01_standard.jpg',
      imageAlt: "Adidas Ultraboost 21 in core black and cloud white",
      price: '$180.00',
      color: 'Core Black/Cloud White',
    },
    {
      id: 3,
      name: 'Puma RS-X3',
      href: '#',
      imageSrc: 'https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_450,h_450/global/371570/01/sv01/fnd/PNA/fmt/png/PUMA-RS-X3-Sneakers',
      imageAlt: "Puma RS-X3 in white and red",
      price: '$110.00',
      color: 'White/Red',
    },
    {
      id: 4,
      name: 'Reebok Nano X1',
      href: '#',
      imageSrc: 'https://cdn.shopify.com/s/files/1/0862/7834/0912/files/1x1_rbk_nanopro.jpg?v=1759766366&width=800',
      imageAlt: "Reebok Nano X1 in black and white",
      price: '$130.00',
      color: 'Black/White',
    },
    {
      id: 5,
      name: 'Puma RS-X3',
      href: '#',
      imageSrc: 'https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_450,h_450/global/371570/01/sv01/fnd/PNA/fmt/png/PUMA-RS-X3-Sneakers',
      imageAlt: "Puma RS-X3 in white and red",
      price: '$110.00',
      color: 'White/Red',
    },
    {
      id: 6,
      name: 'Adidas Ultraboost 21',
      href: '#',
      imageSrc: 'https://assets.adidas.com/images/w_600,f_auto,q_auto/e3a7db18925d4728809baafc0106b761_9366/Ultraboost_20_Shoes_Black_EF1043_01_standard.jpg',
      imageAlt: "Adidas Ultraboost 21 in core black and cloud white",
      price: '$180.00',
      color: 'Core Black/Cloud White',
    },
  ]

  return (
    <>
      <Navbar/>
      <div className="bg-white">
        <div className="hero min-h-screen bg-white relative">
            <div className="max-w-md">
              <video
                className="absolute top-0 left-0 w-full h-full object-cover"
                src="/hero.mp4" 
                autoPlay
                loop
                muted
              />
            </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
        {featuredProducts.map((product) => (
          <div key={product.id} className="card bg-base-300 w-96 shadow-sm mx-auto">
          <figure>
            <img
              src={product.imageSrc}
              alt={product.imageAlt}
              className="h-72 w-full object-cover"
            />
          </figure>
          <div className="card-body">
            <h2 className="card-title">
              {product.name}
              <div className="badge badge-secondary">NEW</div>
            </h2>
            <p>{product.color}</p>
            <div className="card-actions justify-end">
              <div className="badge badge-outline">{product.price}</div>
              <div className="badge badge-outline">Buy Now</div>
            </div>
          </div>
        </div>))}
      </div>
      <Footer />
    </>
  );
}
