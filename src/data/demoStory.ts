export interface StoryPage {
  pageNumber: number;
  heading: string;
  content: string;
  imageCaption: string;
}

export interface Story {
  id: string;
  title: string;
  destination: string;
  pages: StoryPage[];
}

export const demoStory: Story = {
  id: "demo",
  title: "A Magical Adventure in Mallorca",
  destination: "Mallorca, Spain",
  pages: [
    {
      pageNumber: 1,
      heading: "Hola, Mallorca! 🌈",
      content: "Welcome to the beautiful island of Mallorca! When you first arrive, you might visit the amazing La Seu cathedral in Palma. This isn't just any cathedral – it has special stained glass windows that create magical rainbows inside! Long ago, brave builders spent hundreds of years creating this beautiful building. When the sunshine streams through the colorful windows, it paints the stone walls with dancing colors of red, blue, yellow, and green. The windows are so big and bright that they look like giant kaleidoscopes! People come from all around the world to see these rainbow reflections. Can you imagine standing inside and watching the colors dance all around you? It's like being inside a treasure box filled with glowing gems! The cathedral sits right next to the sparkling blue sea, so you can see sailboats floating by while you explore.",
      imageCaption: "La Seu Cathedral with colorful rainbow windows"
    },
    {
      pageNumber: 2,
      heading: "Cala Adventures 🏖️",
      content: "Today we're heading to a secret cala – that's what they call the small, hidden beaches in Mallorca! Imagine finding a cozy beach tucked between tall pine trees and rocky cliffs. The water is so clear and calm that you can see little fish swimming around your toes! You and your friends start building the most amazing sandcastle, using smooth pebbles for towers and seashells for decorations. The sheltered cala protects you from big waves, making it perfect for splashing and playing. Above the beach, pine trees grow right out of the rocky cliffs, their green branches swaying in the warm breeze. Sometimes you can spot tiny crabs scuttling between the rocks, and if you're really quiet, you might see a silvery fish jump! The best part? These calas often feel like your own private beach because they're hidden away from the big tourist spots.",
      imageCaption: "A beautiful hidden cala with crystal clear water"
    },
    {
      pageNumber: 3,
      heading: "Train to Sóller 🚂🍊",
      content: "Get ready for the most fun train ride ever! The wooden train to Sóller has been chugging through the mountains for over 100 years. As the old-fashioned train climbs higher and higher, you can see orange and lemon groves covering the hillsides like a patchwork quilt. The train goes through 13 tunnels – count them as you zoom through the darkness! When you finally reach the pretty town of Sóller, it's time for a special treat: fresh orange gelato made from the local oranges. It tastes like sunshine in a cone! You can sit in the main square and watch people riding old-fashioned trams while you lick your delicious gelato. The whole town smells sweet like orange blossoms. Before you head back, here's something to think about: Why do you think they built a train through the mountains instead of a road? What adventures would you have if you could ride this train every day?",
      imageCaption: "The vintage wooden train passing through orange groves"
    }
  ]
};
