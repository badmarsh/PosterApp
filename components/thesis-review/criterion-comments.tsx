"use client"

/**
 * CriterionComments — Multi-Role Threaded Comments for Rubric Cards.
 *
 * Allows reviewers, supervisors, and committee members to post notes, questions,
 * or consensus remarks directly attached to an evaluation criterion.
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, User, Reply, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CriterionComment {
  id: string
  criterionId: string
  authorName: string
  authorRole: "reviewer" | "supervisor" | "committee" | "student"
  content: string
  createdAt: string
}

interface Props {
  criterionId: string
  initialComments?: CriterionComment[]
  currentUserName?: string
  currentUserRole?: "reviewer" | "supervisor" | "committee" | "student"
}

export function CriterionComments({
  criterionId,
  initialComments = [],
  currentUserName = "Oponent",
  currentUserRole = "reviewer",
}: Props) {
  const [comments, setComments] = useState<CriterionComment[]>(initialComments)
  const [newCommentText, setNewCommentText] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  const handleAddComment = () => {
    if (!newCommentText.trim()) return

    const newComment: CriterionComment = {
      id: `comment-${Date.now()}`,
      criterionId,
      authorName: currentUserName,
      authorRole: currentUserRole,
      content: newCommentText.trim(),
      createdAt: new Date().toISOString(),
    }

    setComments((prev) => [...prev, newComment])
    setNewCommentText("")
  }

  const handleDeleteComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  return (
    <div className="space-y-2 pt-2 border-t text-xs">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5 p-0"
        >
          <MessageSquare className="size-3.5 text-primary" />
          <span>Komentáre a poznámky ({comments.length})</span>
        </Button>
      </div>

      {isOpen && (
        <div className="space-y-3 pt-2 pl-2 border-l-2 border-primary/20">
          {/* Comments List */}
          <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-1">
            {comments.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">
                Zatiaľ žiadne komentáre k tomuto kritériu.
              </p>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-2 rounded-lg bg-muted/40 border space-y-1 relative group"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">{comment.authorName}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 uppercase">
                        {comment.authorRole}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-opacity"
                        title="Zmazať komentár"
                      >
                        <Trash2 className="size-2.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* New Comment Input */}
          <div className="flex items-end gap-2 pt-1">
            <Textarea
              rows={2}
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Pridať internú poznámku alebo komentár..."
              className="text-xs min-h-[44px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleAddComment()
                }
              }}
            />
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!newCommentText.trim()}
              className="h-8 px-2.5 shrink-0"
            >
              <Send className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
