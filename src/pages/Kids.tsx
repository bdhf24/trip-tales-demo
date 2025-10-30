import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, Trash2, RefreshCw, User } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';

interface Kid {
  id: string;
  name: string;
  age: number;
  descriptor: string | null;
  appearance_notes: string | null;
  interests: string[];
  photoCount: number;
  createdAt: string;
}

interface KidPhoto {
  id: string;
  image_url: string;
  notes: string | null;
  created_at: string;
}

interface ReferenceImage {
  id: string;
  page_id: string;
  notes: string | null;
  created_at: string;
  pages: {
    id: string;
    image_url: string;
    heading: string;
    page_number: number;
    story_id: string;
    stories: {
      title: string;
    };
  };
}

const Kids = () => {
  const [kids, setKids] = useState<Kid[]>([]);
  const [selectedKid, setSelectedKid] = useState<Kid | null>(null);
  const [photos, setPhotos] = useState<KidPhoto[]>([]);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [newKidName, setNewKidName] = useState('');
  const [newKidAge, setNewKidAge] = useState('');
  const [editingDescriptor, setEditingDescriptor] = useState('');
  const [editingAppearanceNotes, setEditingAppearanceNotes] = useState('');
  const [editingInterests, setEditingInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  useEffect(() => {
    fetchKids();
  }, []);

  const fetchKids = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('kids-list');
      if (error) throw error;
      setKids(data.kids || []);
    } catch (error) {
      console.error('Error fetching kids:', error);
      toast.error('Failed to load kids profiles');
    }
  };

  const createKid = async () => {
    if (!newKidName || !newKidAge) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('kids-create', {
        body: { name: newKidName, age: parseInt(newKidAge) }
      });

      if (error) throw error;
      
      toast.success(`${newKidName}'s profile created!`);
      setNewKidName('');
      setNewKidAge('');
      setShowCreateDialog(false);
      fetchKids();
    } catch (error) {
      console.error('Error creating kid:', error);
      toast.error('Failed to create profile');
    } finally {
      setIsCreating(false);
    }
  };

  const openKidDetails = async (kid: Kid) => {
    setSelectedKid(kid);
    setEditingDescriptor(kid.descriptor || '');
    setEditingAppearanceNotes(kid.appearance_notes || '');
    setEditingInterests(kid.interests || []);
    
    try {
      const [photosResponse, referencesResponse] = await Promise.all([
        supabase.functions.invoke('kids-get', {
          body: { kidId: kid.id }
        }),
        supabase.functions.invoke('get-kid-references', {
          body: { kidId: kid.id }
        })
      ]);

      if (photosResponse.error) throw photosResponse.error;
      if (referencesResponse.error) throw referencesResponse.error;
      
      setPhotos(photosResponse.data.photos || []);
      setReferences(referencesResponse.data.references || []);
      setShowDetailsDialog(true);
    } catch (error) {
      console.error('Error fetching kid details:', error);
      toast.error('Failed to load kid data');
    }
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedKid || !e.target.files?.[0]) return;

    const file = e.target.files[0];
    
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      toast.error('Only JPG and PNG files are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('kidId', selectedKid.id);
      formData.append('file', file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kids-upload-photo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      toast.success('Photo uploaded!');
      openKidDetails(selectedKid);
      e.target.value = '';
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  const extractDescriptor = async () => {
    if (!selectedKid) return;

    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('kids-extract-descriptor', {
        body: { kidId: selectedKid.id }
      });

      if (error) throw error;
      
      setEditingDescriptor(data.descriptor);
      toast.success(data.fallback ? 'Template created - please edit' : 'Descriptor extracted!');
      fetchKids();
    } catch (error) {
      console.error('Error extracting descriptor:', error);
      toast.error('Failed to extract descriptor');
    } finally {
      setIsExtracting(false);
    }
  };

  const updateDescriptor = async () => {
    if (!selectedKid) return;

    try {
      const { error } = await supabase.functions.invoke('kids-update', {
        body: { 
          kidId: selectedKid.id, 
          descriptor: editingDescriptor,
          appearance_notes: editingAppearanceNotes,
          interests: editingInterests
        }
      });

      if (error) throw error;
      
      toast.success('Profile updated!');
      fetchKids();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  const toggleInterest = (interest: string) => {
    setEditingInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const addCustomInterest = () => {
    if (!customInterest.trim()) return;
    if (editingInterests.includes(customInterest.trim())) {
      toast.error('Interest already added');
      return;
    }
    setEditingInterests(prev => [...prev, customInterest.trim()]);
    setCustomInterest('');
  };

  const removeInterest = (interest: string) => {
    setEditingInterests(prev => prev.filter(i => i !== interest));
  };

  const deleteReference = async (refId: string) => {
    if (!selectedKid) return;

    try {
      await supabase
        .from('reference_images')
        .delete()
        .eq('id', refId);
      
      toast.success('Reference removed');
      openKidDetails(selectedKid);
    } catch (error) {
      console.error('Error deleting reference:', error);
      toast.error('Failed to delete reference');
    }
  };

  const deleteKid = async (kidId: string, kidName: string) => {
    if (!confirm(`Are you sure you want to delete ${kidName}'s profile?`)) return;

    try {
      const { error } = await supabase.functions.invoke('kids-delete', {
        body: { kidId }
      });

      if (error) throw error;
      
      toast.success('Profile deleted');
      setShowDetailsDialog(false);
      fetchKids();
    } catch (error) {
      console.error('Error deleting kid:', error);
      toast.error('Failed to delete profile');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Character Profiles</h1>
            <p className="text-muted-foreground">Upload photos and add interests to create character descriptors for stories</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Character
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Character Profile</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newKidName}
                    onChange={(e) => setNewKidName(e.target.value)}
                    placeholder="Enter name"
                  />
                </div>
                <div>
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={newKidAge}
                    onChange={(e) => setNewKidAge(e.target.value)}
                    placeholder="Enter age"
                  />
                </div>
                <Button onClick={createKid} disabled={isCreating} className="w-full">
                  {isCreating ? 'Creating...' : 'Create Profile'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {kids.length === 0 ? (
          <Card className="p-12 text-center">
            <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mb-2">No character profiles yet</h2>
            <p className="text-muted-foreground mb-6">
              Create profiles to add character consistency to your stories
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {kids.map((kid) => (
              <Card key={kid.id} className="p-6 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openKidDetails(kid)}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{kid.name}</h3>
                    <p className="text-sm text-muted-foreground">Age {kid.age}</p>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    {kid.photoCount} {kid.photoCount === 1 ? 'photo' : 'photos'}
                  </span>
                </div>
                {kid.interests && kid.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {kid.interests.slice(0, 3).map(interest => (
                      <Badge key={interest} variant="secondary" className="text-xs">{interest}</Badge>
                    ))}
                    {kid.interests.length > 3 && (
                      <Badge variant="secondary" className="text-xs">+{kid.interests.length - 3}</Badge>
                    )}
                  </div>
                )}
                {kid.descriptor ? (
                  <p className="text-sm text-muted-foreground line-clamp-3">{kid.descriptor}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No descriptor yet - upload photos</p>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Kid Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            {selectedKid && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedKid.name}'s Profile</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* Photos Section */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold">Photos ({photos.length})</h3>
                      <Button size="sm" disabled={isUploading} onClick={() => document.getElementById('photo-upload')?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        {isUploading ? 'Uploading...' : 'Upload'}
                      </Button>
                      <input
                        id="photo-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/jpg"
                        className="hidden"
                        onChange={uploadPhoto}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {photos.map((photo) => (
                        <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                          <img
                            src={photo.image_url}
                            alt="Kid photo"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* References */}
                  {references.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Character References ({references.length})</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {references.map((ref) => (
                          <div key={ref.id} className="relative group">
                            <img src={ref.pages.image_url} alt="Reference" className="w-full h-40 object-cover rounded" />
                            <Button
                              size="icon"
                              variant="destructive"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteReference(ref.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <p className="text-xs text-muted-foreground mt-1">{ref.pages.stories.title} - Page {ref.pages.page_number}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Descriptor Section */}
                  <div>
                    <Label htmlFor="descriptor">Character Descriptor</Label>
                    <Textarea id="descriptor" value={editingDescriptor} onChange={(e) => setEditingDescriptor(e.target.value)} placeholder="Physical appearance description..." className="h-24" />
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={extractDescriptor} disabled={isExtracting || photos.length === 0}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {isExtracting ? 'Extracting...' : 'Extract from Photos'}
                      </Button>
                      <Button size="sm" onClick={updateDescriptor}>Save</Button>
                    </div>
                  </div>

                  {/* Interests Section */}
                  <div>
                    <Label>Interests</Label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {["animals", "sports", "art", "music", "science", "space", "nature", "cooking", "building", "reading"].map(interest => (
                        <Badge key={interest} variant={editingInterests.includes(interest) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleInterest(interest)}>{interest}</Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Add custom interest..." value={customInterest} onChange={(e) => setCustomInterest(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addCustomInterest()} />
                      <Button size="sm" onClick={addCustomInterest}>Add</Button>
                    </div>
                    {editingInterests.filter(i => !["animals", "sports", "art", "music", "science", "space", "nature", "cooking", "building", "reading"].includes(i)).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {editingInterests.filter(i => !["animals", "sports", "art", "music", "science", "space", "nature", "cooking", "building", "reading"].includes(i)).map(interest => (
                          <Badge key={interest} variant="secondary" className="cursor-pointer" onClick={() => removeInterest(interest)}>{interest} ×</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Appearance Notes */}
                  <div>
                    <Label htmlFor="appearance">Appearance Notes</Label>
                    <Textarea id="appearance" value={editingAppearanceNotes} onChange={(e) => setEditingAppearanceNotes(e.target.value)} placeholder="Additional details..." className="h-20" />
                  </div>

                  <Button variant="destructive" onClick={() => deleteKid(selectedKid.id, selectedKid.name)} className="w-full">Delete Profile</Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Kids;
