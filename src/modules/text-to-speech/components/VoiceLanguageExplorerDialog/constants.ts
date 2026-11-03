import {
  MessageSquare,
  BookOpen,
  Smile,
  Share2,
  GraduationCap,
  Megaphone,
  Tv,
  LucideIcon,
} from 'lucide-react'
import { Voice } from '../../types'

export interface CategoryChip {
  id: string
  label: string
  icon: LucideIcon
}

export const CATEGORY_CHIPS: CategoryChip[] = [
  { id: 'Conversational', label: 'Conversational', icon: MessageSquare },
  { id: 'Narration', label: 'Narration', icon: BookOpen },
  { id: 'Characters', label: 'Characters', icon: Smile },
  { id: 'Social Media', label: 'Social Media', icon: Share2 },
  { id: 'Educational', label: 'Educational', icon: GraduationCap },
  { id: 'Advertisement', label: 'Advertisement', icon: Megaphone },
  { id: 'Entertainment', label: 'Entertainment', icon: Tv },
]

export function matchesCategoryFilter(voice: Voice, categories: string[]): boolean {
  if (categories.length === 0) return true

  return categories.some((cat) => {
    const catLower = cat.toLowerCase()

    // Direct tag match
    if (
      voice.tags.some(
        (t) =>
          t.toLowerCase() === catLower ||
          t.toLowerCase().includes(catLower) ||
          catLower.includes(t.toLowerCase())
      )
    ) {
      return true
    }
    if (voice.description.toLowerCase().includes(catLower)) return true
    if (voice.name.toLowerCase().includes(catLower)) return true

    // Semantic category synonym matching
    if (catLower === 'conversational') {
      return (
        voice.description.toLowerCase().includes('agentic') ||
        voice.description.toLowerCase().includes('assistant') ||
        voice.description.toLowerCase().includes('conversation') ||
        voice.description.toLowerCase().includes('casual') ||
        voice.tags.some((t) =>
          ['conversational', 'casual', 'friendly', 'warm', 'trustworthy'].includes(t.toLowerCase())
        )
      )
    }
    if (catLower === 'narration') {
      return (
        voice.description.toLowerCase().includes('narrat') ||
        voice.description.toLowerCase().includes('story') ||
        voice.description.toLowerCase().includes('stories') ||
        voice.tags.some((t) =>
          ['narrative', 'narration', 'narrative story', 'resonant', 'storyteller'].includes(t.toLowerCase())
        )
      )
    }
    if (catLower === 'social media') {
      return (
        voice.description.toLowerCase().includes('shorts') ||
        voice.description.toLowerCase().includes('reels') ||
        voice.description.toLowerCase().includes('creator') ||
        voice.tags.some((t) =>
          ['social media', 'creator', 'trendy', 'hyped'].includes(t.toLowerCase())
        )
      )
    }
    if (catLower === 'characters') {
      return (
        voice.description.toLowerCase().includes('warrior') ||
        voice.description.toLowerCase().includes('animated') ||
        voice.description.toLowerCase().includes('character') ||
        voice.tags.some((t) =>
          ['characters', 'animation', 'theatrical', 'distinctive', 'fierce'].includes(t.toLowerCase())
        )
      )
    }
    if (catLower === 'educational') {
      return (
        voice.description.toLowerCase().includes('educat') ||
        voice.description.toLowerCase().includes('academic') ||
        voice.description.toLowerCase().includes('informative') ||
        voice.tags.some((t) =>
          ['educational', 'articulate', 'professional', 'clear'].includes(t.toLowerCase())
        )
      )
    }
    if (catLower === 'advertisement') {
      return (
        voice.description.toLowerCase().includes('broadcast') ||
        voice.description.toLowerCase().includes('commercial') ||
        voice.tags.some((t) =>
          ['advertisement', 'broadcast', 'commercial', 'news'].includes(t.toLowerCase())
        )
      )
    }
    if (catLower === 'entertainment') {
      return (
        voice.description.toLowerCase().includes('playful') ||
        voice.description.toLowerCase().includes('theat') ||
        voice.tags.some((t) =>
          ['entertainment', 'theatrical', 'expressive', 'optimist'].includes(t.toLowerCase())
        )
      )
    }
    return false
  })
}
