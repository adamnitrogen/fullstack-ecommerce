import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aboutService } from "@/services/about.service";
import {
  AboutCard,
  ImpactStat,
  TimelineItem,
  TeamMember,
  FutureGoal,
  AboutUsSectionVisibility,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import AboutCardDialog from "@/components/admin/AboutCardDialog";
import ImpactStatDialog from "@/components/admin/ImpactStatDialog";
import TimelineItemDialog from "@/components/admin/TimelineItemDialog";
import TeamMemberDialog from "@/components/admin/TeamMemberDialog";
import FutureGoalDialog from "@/components/admin/FutureGoalDialog";

export default function AboutUsManagement() {
  const [activeTab, setActiveTab] = useState("cards");
  const [editingCard, setEditingCard] = useState<AboutCard | null>(null);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editingStat, setEditingStat] = useState<ImpactStat | null>(null);
  const [statDialogOpen, setStatDialogOpen] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState<TimelineItem | null>(
    null
  );
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [editingTeamMember, setEditingTeamMember] = useState<TeamMember | null>(
    null
  );
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FutureGoal | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingFooter, setEditingFooter] = useState(false);
  const [footerDescription, setFooterDescription] = useState("");
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    type: string;
    name: string;
  } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: aboutContent } = useQuery({
    queryKey: ["aboutUs"],
    queryFn: () => aboutService.getAll(),
  });

  // Delete mutations
  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteCard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Card deleted successfully" });
      setDeleteItem(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to delete card",
        description: getErrorMessage(error, "Failed to delete card"),
        variant: "destructive",
      });
    },
  });

  const deleteTimelineMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteTimeline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Timeline item deleted successfully" });
      setDeleteItem(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to delete timeline item",
        description: getErrorMessage(error, "Failed to delete timeline item"),
        variant: "destructive",
      });
    },
  });

  const deleteTeamMemberMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteTeamMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Team member deleted successfully" });
      setDeleteItem(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to delete team member",
        description: getErrorMessage(error, "Failed to delete team member"),
        variant: "destructive"
      });
    },
  });

  const deleteStatMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteStat(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Impact stat deleted successfully" });
      setDeleteItem(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to delete impact stat",
        description: getErrorMessage(error, "Failed to delete impact stat"),
        variant: "destructive",
      });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Goal deleted successfully" });
      setDeleteItem(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to delete goal",
        description: getErrorMessage(error, "Failed to delete goal"),
        variant: "destructive",
      });
    },
  });

  const updateFooterMutation = useMutation({
    mutationFn: (description: string) => {
      return aboutService.updateSettings({ footer_description: description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Footer description updated successfully" });
      setEditingFooter(false);
    },
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: (visibility: Partial<AboutUsSectionVisibility>) => {
      const defaultVisibility: AboutUsSectionVisibility = {
        missionVision: true,
        impactStats: true,
        ourStory: true,
        team: true,
        futureGoals: true,
        callToAction: true,
      };
      const currentVisibility = aboutContent?.sectionVisibility || defaultVisibility;
      const newVisibility = { ...currentVisibility, ...visibility };
      return aboutService.updateSettings({ section_visibility: newVisibility });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Section visibility updated successfully" });
    },
  });

  const handleDelete = () => {
    if (!deleteItem) return;

    switch (deleteItem.type) {
      case "card":
        deleteCardMutation.mutate(deleteItem.id);
        break;
      case "stat":
        deleteStatMutation.mutate(deleteItem.id);
        break;
      case "timeline":
        deleteTimelineMutation.mutate(deleteItem.id);
        break;
      case "team":
        deleteTeamMemberMutation.mutate(deleteItem.id);
        break;
      case "goal":
        deleteGoalMutation.mutate(deleteItem.id);
        break;
    }
  };

  const handleSaveFooter = () => {
    updateFooterMutation.mutate(footerDescription);
  };

  const handleVisibilityToggle = (
    section: keyof AboutUsSectionVisibility,
    value: boolean
  ) => {
    updateVisibilityMutation.mutate({ [section]: value });
  };

  if (!aboutContent) {
    return <div>Loading content...</div>;
  }

  // Ensure sectionVisibility exists with defaults
  const sectionVisibility = aboutContent.sectionVisibility || {
    missionVision: true,
    impactStats: true,
    ourStory: true,
    team: true,
    futureGoals: true,
    callToAction: true,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">About Us Management</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="impact">Impact Stats</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="goals">Future Goals</TabsTrigger>
          <TabsTrigger value="visibility">Visibility</TabsTrigger>
          <TabsTrigger value="footer">Footer</TabsTrigger>
        </TabsList>

        {/* Cards Tab */}
        <TabsContent value="cards" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Mission & Vision Cards</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingCard(null);
                    setCardDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Card
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Icon</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aboutContent.cards
                    .sort((a, b) => a.order - b.order)
                    .map((card) => (
                      <TableRow key={card.id}>
                        <TableCell className="font-medium">
                          {card.title}
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {card.description}
                        </TableCell>
                        <TableCell>{card.icon}</TableCell>
                        <TableCell>{card.order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingCard(card);
                                setCardDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteItem({
                                  id: card.id,
                                  type: "card",
                                  name: card.title,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Impact Stats Tab */}
        <TabsContent value="impact" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Impact Statistics</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingStat(null);
                    setStatDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Impact Stat
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Value</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Icon</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aboutContent.impactStats
                    .sort((a, b) => a.order - b.order)
                    .map((stat) => (
                      <TableRow key={stat.id}>
                        <TableCell className="font-medium">
                          {stat.value}
                        </TableCell>
                        <TableCell>{stat.label}</TableCell>
                        <TableCell>{stat.icon}</TableCell>
                        <TableCell>{stat.order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingStat(stat);
                                setStatDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteItem({
                                  id: stat.id,
                                  type: "stat",
                                  name: stat.label,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Our Story Timeline</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingTimeline(null);
                    setTimelineDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Timeline Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aboutContent.timeline
                    .sort((a, b) => a.order - b.order)
                    .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.month} {item.year}
                        </TableCell>
                        <TableCell>{item.title}</TableCell>
                        <TableCell className="max-w-md truncate">
                          {item.description}
                        </TableCell>
                        <TableCell>{item.order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTimeline(item);
                                setTimelineDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteItem({
                                  id: item.id,
                                  type: "timeline",
                                  name: item.title,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Team Members</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingTeamMember(null);
                    setTeamDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Team Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Bio</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aboutContent.teamMembers
                    .sort((a, b) => a.order - b.order)
                    .map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="relative group">
                            <img
                              src={member.image}
                              alt={member.name}
                              loading="lazy"
                              className="w-10 h-10 rounded-full object-cover border-2 border-border"
                            />
                            {/* Hover Preview */}
                            <div className="absolute left-0 top-12 z-50 hidden group-hover:block">
                              <div className="bg-popover border shadow-lg rounded-lg p-2">
                                <img
                                  src={member.image}
                                  alt={member.name}
                                  loading="lazy"
                                  className="w-32 h-32 rounded-lg object-cover"
                                />
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {member.name}
                        </TableCell>
                        <TableCell>{member.role}</TableCell>
                        <TableCell className="max-w-md truncate">
                          {member.bio}
                        </TableCell>
                        <TableCell>{member.order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTeamMember(member);
                                setTeamDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteItem({
                                  id: member.id,
                                  type: "team",
                                  name: member.name,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Future Goals Tab */}
        <TabsContent value="goals" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Future Goals</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingGoal(null);
                    setGoalDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Goal
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aboutContent.futureGoals
                    .sort((a, b) => a.order - b.order)
                    .map((goal) => (
                      <TableRow key={goal.id}>
                        <TableCell className="font-medium">
                          {goal.title}
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {goal.description}
                        </TableCell>
                        <TableCell>{goal.order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingGoal(goal);
                                setGoalDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteItem({
                                  id: goal.id,
                                  type: "goal",
                                  name: goal.title,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Section Visibility Tab */}
        <TabsContent value="visibility" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Section Visibility Settings</CardTitle>
              <p className="text-sm text-muted-foreground">
                Control which sections appear on the About Us page. Toggle
                switches to show or hide sections.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <Label
                      htmlFor="visibility-mission"
                      className="text-base font-semibold cursor-pointer"
                    >
                      Mission & Vision Cards
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Display the mission and vision cards section
                    </p>
                  </div>
                  <Switch
                    id="visibility-mission"
                    checked={sectionVisibility.missionVision}
                    onCheckedChange={(checked) =>
                      handleVisibilityToggle("missionVision", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <Label
                      htmlFor="visibility-impact"
                      className="text-base font-semibold cursor-pointer"
                    >
                      Impact Statistics
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Display the impact statistics section
                    </p>
                  </div>
                  <Switch
                    id="visibility-impact"
                    checked={sectionVisibility.impactStats}
                    onCheckedChange={(checked) =>
                      handleVisibilityToggle("impactStats", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <Label
                      htmlFor="visibility-story"
                      className="text-base font-semibold cursor-pointer"
                    >
                      Our Story Timeline
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Display the timeline section showing organization history
                    </p>
                  </div>
                  <Switch
                    id="visibility-story"
                    checked={sectionVisibility.ourStory}
                    onCheckedChange={(checked) =>
                      handleVisibilityToggle("ourStory", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <Label
                      htmlFor="visibility-team"
                      className="text-base font-semibold cursor-pointer"
                    >
                      Team Members
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Display the team members section
                    </p>
                  </div>
                  <Switch
                    id="visibility-team"
                    checked={sectionVisibility.team}
                    onCheckedChange={(checked) =>
                      handleVisibilityToggle("team", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <Label
                      htmlFor="visibility-goals"
                      className="text-base font-semibold cursor-pointer"
                    >
                      Future Goals
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Display the future goals section
                    </p>
                  </div>
                  <Switch
                    id="visibility-goals"
                    checked={sectionVisibility.futureGoals}
                    onCheckedChange={(checked) =>
                      handleVisibilityToggle("futureGoals", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <Label
                      htmlFor="visibility-cta"
                      className="text-base font-semibold cursor-pointer"
                    >
                      Call to Action
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Display the call to action section with Donate/Volunteer
                      buttons
                    </p>
                  </div>
                  <Switch
                    id="visibility-cta"
                    checked={sectionVisibility.callToAction}
                    onCheckedChange={(checked) =>
                      handleVisibilityToggle("callToAction", checked)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Footer Tab */}
        <TabsContent value="footer" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Footer Description</CardTitle>
                {!editingFooter && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setFooterDescription(aboutContent.footerDescription);
                      setEditingFooter(true);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingFooter ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="footer-description">Description</Label>
                    <Textarea
                      id="footer-description"
                      value={footerDescription}
                      onChange={(e) => setFooterDescription(e.target.value)}
                      rows={6}
                      placeholder="Enter footer description for Goshala..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveFooter}>Save</Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditingFooter(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {aboutContent.footerDescription}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Delete Item"
        description={`Are you sure you want to delete "${deleteItem?.name}"? This action cannot be undone.`}
      />

      <AboutCardDialog
        open={cardDialogOpen}
        onOpenChange={setCardDialogOpen}
        card={editingCard}
      />

      <ImpactStatDialog
        open={statDialogOpen}
        onOpenChange={setStatDialogOpen}
        stat={editingStat}
      />

      <TimelineItemDialog
        open={timelineDialogOpen}
        onOpenChange={setTimelineDialogOpen}
        item={editingTimeline}
      />

      <TeamMemberDialog
        open={teamDialogOpen}
        onOpenChange={setTeamDialogOpen}
        member={editingTeamMember}
      />

      <FutureGoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        goal={editingGoal}
      />
    </div>
  );
}
