import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Upload, Trash2, RefreshCw, User } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';

interface Kid {
  id: string;
  name: string;
  age: number;
  descriptor: string | null;
  appearance_notes: string | null;
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
    
    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      toast.error('Only JPG and PNG files are allowed');
      return;
    }

    // Validate file size (5MB)
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
      // Clear the file input
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
          appearance_notes: editingAppearanceNotes 
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
            <h1 className="text-4xl font-bold text-foreground mb-2">Kids Profiles</h1>
            <p className="text-muted-foreground">Upload photos to create character descriptors for stories</p>
            <p className="text-sm text-muted-foreground mt-2">
              Photos are stored privately for descriptor extraction. Generated images use text descriptors only.
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Kid
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Kid Profile</DialogTitle>
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
            <h2 className="text-2xl font-semibold mb-2">No kids profiles yet</h2>
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
                    <div className="grid grid-cols-3 gap-3">
                      {photos.map((photo) => (
                        <img
                          key={photo.id}
                          src={photo.image_url}
                          alt="Kid photo"
                          className="w-full h-32 object-cover rounded"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Reference Gallery */}
                  {references.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Character References ({references.length})</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {references.map((ref) => (
                          <div key={ref.id} className="relative group">
                            <img
                              src={ref.pages.image_url}
                              alt={`Reference from ${ref.pages.stories.title}`}
                              className="w-full h-40 object-cover rounded"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex flex-col items-center justify-center p-2 text-white text-xs">
                              <p className="font-semibold">{ref.pages.stories.title}</p>
                              <p>Page {ref.pages.page_number}</p>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="mt-2"
                                onClick={() => deleteReference(ref.id)}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        These story pages are used as additional references for consistent character appearance
                      </p>
                    </div>
                  )}

                  {/* Descriptor Section */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold">Character Descriptor</h3>
                      <Button
                        size="sm"
                        disabled={isExtracting || photos.length === 0}
                        onClick={extractDescriptor}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isExtracting ? 'animate-spin' : ''}`} />
                        {isExtracting ? 'Extracting...' : 'Extract from Photos'}
                      </Button>
                    </div>
                    <Textarea
                      value={editingDescriptor}
                      onChange={(e) => setEditingDescriptor(e.target.value)}
                      placeholder="Upload photos and extract descriptor, or type manually"
                      rows={4}
                      className="mb-2"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      This descriptor will be used in story image prompts for better character consistency
                    </p>
                  </div>

                  {/* Appearance Notes Section */}
                  <div>
                    <h3 className="font-semibold mb-3">Appearance Notes (Optional)</h3>
                    <Textarea
                      value={editingAppearanceNotes}
                      onChange={(e) => setEditingAppearanceNotes(e.target.value)}
                      placeholder="e.g., 'Leo should have shorter hair', 'Sasha's eyes should be bigger', 'warmer skin tone'"
                      rows={3}
                      className="mb-2"
                    />
                    <Button size="sm" onClick={updateDescriptor}>
                      Save Changes
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Add specific feedback about how the character should look. These notes will enhance future image generation.
                    </p>
                  </div>

                  {/* Delete Section */}
                  <div className="pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteKid(selectedKid.id, selectedKid.name)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Profile
                    </Button>
                  </div>
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
