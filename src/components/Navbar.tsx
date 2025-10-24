import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plane, Library, Users } from "lucide-react";

const Navbar = () => {
  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-gradient-to-br from-primary to-accent p-2 rounded-xl group-hover:scale-110 transition-transform">
              <Plane className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              TripTales
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link to="/library">
              <Button variant="ghost" size="sm" className="gap-2">
                <Library className="h-4 w-4" />
                Library
              </Button>
            </Link>
            <Link to="/kids">
              <Button variant="ghost" size="sm" className="gap-2">
                <Users className="h-4 w-4" />
                Characters
              </Button>
            </Link>
            <Link to="/new">
              <Button size="lg" className="rounded-full font-semibold shadow-lg">
                Create a Story
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
