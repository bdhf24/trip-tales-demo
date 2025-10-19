import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { Sparkles, Book, Globe } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-6 py-3 rounded-full mb-8">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold text-primary">
                Adventures Made Memorable
              </span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent leading-tight">
              TripTales
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto">
              Turn your family adventures into personalized storybooks that bring your travels to life for kids aged 5–8.
            </p>

            <Link to="/new">
              <Button 
                size="lg" 
                className="rounded-full text-lg font-semibold px-10 py-7 shadow-xl hover:shadow-2xl transition-all hover:scale-105"
              >
                Create Your Story
                <Sparkles className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-2 gap-6 mt-16">
            <div className="bg-card rounded-3xl p-8 border-2 border-primary/20 hover:border-primary/40 transition-colors">
              <div className="bg-gradient-to-br from-primary to-primary/70 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                <Book className="h-8 w-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3">Easy to Create</h3>
              <p className="text-muted-foreground">
                Simply enter your destination and travel details to generate a unique story.
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border-2 border-secondary/20 hover:border-secondary/40 transition-colors">
              <div className="bg-gradient-to-br from-secondary to-secondary/70 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                <Globe className="h-8 w-8 text-secondary-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3">Educational Fun</h3>
              <p className="text-muted-foreground">
                Stories packed with local history, culture, and curiosity-sparking questions.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Landing;
