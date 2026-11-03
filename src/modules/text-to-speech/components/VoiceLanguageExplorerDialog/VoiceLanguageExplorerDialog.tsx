import { useState, useMemo, useEffect, useRef } from 'react'
import { Volume2, Search, Loader2, Mic, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LANGUAGES, packagesToLanguageOptions } from '@/lib/constants/languages'
import {
  scanVoiceSamples,
  loadVoicesForLanguage,
  loadAllVoices,
  VoicePackageInfo,
} from '@/lib/services/voiceLoader'
import { matchesCategoryFilter } from './constants'
import { VoiceExplorerSidebar } from './VoiceExplorerSidebar'
import { VoiceExplorerToolbar } from './VoiceExplorerToolbar'
import { VoiceExplorerFilterChips } from './VoiceExplorerFilterChips'
import { VoiceListItem } from './VoiceListItem'
import { VoiceExplorerFooter } from './VoiceExplorerFooter'
import {
  VoiceLanguageExplorerDialogProps,
  ExplorerTab,
  GenderFilter,
} from './types'
import { Voice } from '../../types'

export function VoiceLanguageExplorerDialog({
  isOpen,
  onClose,
  activeVoiceId,
  activeLanguage,
  voices,
  playingVoiceId,
  onTogglePreview,
  onSelectVoice,
  onSelectLanguage,
  onOpenCloneModal,
  onVoicesLoaded,
  onDeleteVoice,
}: VoiceLanguageExplorerDialogProps) {
  const [activeTab, setActiveTab] = useState<ExplorerTab>('explore')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>(
    activeLanguage.code === 'auto' ? 'all' : activeLanguage.code
  )
  const [selectedGender, setSelectedGender] = useState<GenderFilter>('all')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [packages, setPackages] = useState<VoicePackageInfo[]>([])
  const [dynamicVoices, setDynamicVoices] = useState<Voice[]>([])
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)

  const onVoicesLoadedRef = useRef(onVoicesLoaded)
  useEffect(() => {
    onVoicesLoadedRef.current = onVoicesLoaded
  }, [onVoicesLoaded])

  // 1. Analyze and scan samples folder on mount or when opened
  useEffect(() => {
    let isMounted = true
    scanVoiceSamples().then((pkgs) => {
      if (isMounted && pkgs.length > 0) {
        setPackages(pkgs)
      }
    })
    return () => {
      isMounted = false
    }
  }, [isOpen])

  // Available languages list derived from discovered packages
  const availableLanguages = useMemo(() => {
    return packages.length > 0 ? packagesToLanguageOptions(packages) : LANGUAGES
  }, [packages])

  // 2. Dynamically load voices whenever selectedLanguageCode changes or dialog opens
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    setIsLoadingVoices(true)

    const fetcher =
      selectedLanguageCode === 'all'
        ? loadAllVoices()
        : loadVoicesForLanguage(selectedLanguageCode)

    fetcher
      .then((loaded) => {
        if (!isMounted) return
        if (loaded && loaded.length > 0) {
          setDynamicVoices(loaded)
          onVoicesLoadedRef.current?.(loaded)
        }
      })
      .catch((err) => {
        console.warn('[VoiceExplorer] Error loading voices:', err)
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingVoices(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, selectedLanguageCode])

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    )
  }

  const resetFilters = () => {
    setSelectedLanguageCode('all')
    setSelectedGender('all')
    setSelectedCategories([])
    setSearchQuery('')
  }

  // Combined voices list (props voices + dynamically loaded voices)
  const combinedVoices = useMemo(() => {
    const map = new Map<string, Voice>()
    voices.forEach((v) => map.set(v.id, v))
    dynamicVoices.forEach((v) => map.set(v.id, v))
    return Array.from(map.values())
  }, [voices, dynamicVoices])

  // Filtered voice list
  const filteredVoices = useMemo(() => {
    return combinedVoices.filter((v) => {
      // 1. "My voices" tab: show cloned/custom voices only, filtered by search query if present
      if (activeTab === 'my-voices') {
        if (v.category !== 'cloned') return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchesName = v.name.toLowerCase().includes(q)
          const matchesDesc = v.description.toLowerCase().includes(q)
          const matchesTag = v.tags.some((t) => t.toLowerCase().includes(q))
          return matchesName || matchesDesc || matchesTag
        }
        return true
      }

      // "Explore" tab: preset library voices (exclude custom cloned)
      if (v.category === 'cloned') {
        return false
      }

      // 2. Language filter
      if (selectedLanguageCode !== 'all') {
        const langObj = availableLanguages.find((l) => l.code === selectedLanguageCode)
        const langName = langObj?.name.toLowerCase() || ''
        const vLangCode = v.languageCode?.toLowerCase() || ''

        if (selectedLanguageCode === 'en') {
          const isUs =
            vLangCode === 'en' ||
            (!v.languageCode && v.tags.some((t) => t.toLowerCase() === 'american'))
          if (!isUs) return false
        } else if (selectedLanguageCode === 'en-gb') {
          const isGb =
            vLangCode === 'en-gb' ||
            v.tags.some((t) => t.toLowerCase() === 'british')
          if (!isGb) return false
        } else if (selectedLanguageCode === 'en-au') {
          const isAu =
            vLangCode === 'en-au' ||
            v.tags.some(
              (t) =>
                t.toLowerCase() === 'australian' ||
                t.toLowerCase().includes('australia')
            )
          if (!isAu) return false
        } else if (selectedLanguageCode === 'en-af') {
          const isAf =
            vLangCode === 'en-af' ||
            v.tags.some(
              (t) =>
                t.toLowerCase() === 'african' ||
                t.toLowerCase().includes('africa')
            )
          if (!isAf) return false
        } else {
          const matchesCode = vLangCode === selectedLanguageCode
          const matchesName =
            langName &&
            (v.languageName?.toLowerCase() === langName ||
              v.tags.some((t) => t.toLowerCase() === langName))
          if (!matchesCode && !matchesName) return false
        }
      }

      // 3. Gender filter
      if (selectedGender !== 'all') {
        const vGender = (v.gender || 'neutral').toLowerCase()
        if (vGender !== selectedGender) return false
      }

      // 4. Category / Tag filter
      if (!matchesCategoryFilter(v, selectedCategories)) {
        return false
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = v.name.toLowerCase().includes(q)
        const matchesDesc = v.description.toLowerCase().includes(q)
        const matchesTag = v.tags.some((t) => t.toLowerCase().includes(q))
        const matchesLang =
          v.languageName?.toLowerCase().includes(q) ||
          v.languageCode?.toLowerCase().includes(q)
        if (!matchesName && !matchesDesc && !matchesTag && !matchesLang) return false
      }

      return true
    })
  }, [
    combinedVoices,
    activeTab,
    selectedLanguageCode,
    selectedGender,
    selectedCategories,
    searchQuery,
    availableLanguages,
  ])

  const selectedLangObj = useMemo(() => {
    if (selectedLanguageCode === 'all')
      return { name: 'All Languages', flag: '🌐' }
    return (
      availableLanguages.find((l) => l.code === selectedLanguageCode) || {
        name: 'Select Language',
        flag: '🌐',
      }
    )
  }, [selectedLanguageCode, availableLanguages])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-4xl w-[96vw] h-[640px] max-h-[92vh] bg-[#0f0f10] border border-white/10 text-white p-0 shadow-2xl rounded-2xl flex flex-col overflow-hidden"
      >
        {/* Hidden screen-reader accessibility header */}
        <DialogHeader className="sr-only">
          <DialogTitle>Voice and Language Library</DialogTitle>
          <DialogDescription>
            Explore and filter voices by language, gender, and categories.
          </DialogDescription>
        </DialogHeader>

        {/* DIALOG MAIN SPLIT CONTAINER */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* LEFT SIDEBAR: FILTERS */}
          <VoiceExplorerSidebar
            selectedLanguageCode={selectedLanguageCode}
            onSelectLanguageCode={setSelectedLanguageCode}
            onSelectLanguageName={onSelectLanguage}
            selectedGender={selectedGender}
            onSelectGender={setSelectedGender}
            selectedCategories={selectedCategories}
            onToggleCategory={toggleCategory}
            selectedLangObj={selectedLangObj}
            availableLanguages={availableLanguages}
          />

          {/* RIGHT MAIN PANEL */}
          <main className="flex-1 flex flex-col min-w-0 bg-[#0f0f10] overflow-hidden">
            {/* Top Toolbar */}
            <VoiceExplorerToolbar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onClose={onClose}
            />

            {/* Scrollable Voice Rows */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 sidebar-scrollbar">
              {/* Active Filter Chips Bar */}
              <VoiceExplorerFilterChips
                selectedLanguageCode={selectedLanguageCode}
                onResetLanguage={() => setSelectedLanguageCode('all')}
                selectedLangObj={selectedLangObj}
                selectedGender={selectedGender}
                onResetGender={() => setSelectedGender('all')}
                selectedCategories={selectedCategories}
                onRemoveCategory={toggleCategory}
                searchQuery={searchQuery}
                onResetFilters={resetFilters}
              />

              {/* Special Top Row: Auto-Select Voice */}
              {activeTab === 'explore' && !searchQuery && (
                <div
                  onClick={() => {
                    onSelectVoice(combinedVoices[0]?.id || 'voice-en-male-1')
                    onClose()
                  }}
                  className="flex items-center justify-between p-3 rounded-xl border border-[#27272a]/60 bg-[#141417]/40 hover:bg-[#1a1a1e] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
                      <Volume2 className="size-4 text-zinc-300" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Auto-select voice
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        Picks a voice based on your text and language when you generate
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-500 border border-white/10 px-2 py-0.5 rounded-full font-mono">
                    Dynamic
                  </span>
                </div>
              )}

              {/* Loading indicator */}
              {isLoadingVoices && filteredVoices.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                  <Loader2 className="size-7 text-zinc-400 animate-spin" />
                  <div className="text-xs text-zinc-400 font-medium">
                    Loading voices for {selectedLangObj.name}...
                  </div>
                </div>
              )}

              {/* No Voices Match Fallback */}
              {!isLoadingVoices && filteredVoices.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  {activeTab === 'my-voices' ? (
                    <>
                      <div className="size-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-400">
                        <Mic className="size-6" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          No custom voices yet
                        </div>
                        <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                          Clone or import your own voice by uploading an audio sample or recording with your microphone.
                        </p>
                      </div>
                      {onOpenCloneModal && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            onClose()
                            onOpenCloneModal()
                          }}
                          className="text-xs rounded-lg mt-2 bg-white text-black hover:bg-zinc-200 font-medium cursor-pointer"
                        >
                          <Plus className="size-3.5 mr-1.5" />
                          Import / Clone Voice
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="size-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-500">
                        <Search className="size-6" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          No voices match your filters
                        </div>
                        <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                          Try clearing filters or search terms to see the full list of available voices.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetFilters}
                        className="text-xs rounded-lg mt-1 cursor-pointer"
                      >
                        Reset Filters
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Voice Items */}
              {filteredVoices.map((v) => (
                <VoiceListItem
                  key={v.id}
                  voice={v}
                  isSelected={activeVoiceId === v.id}
                  isPlaying={playingVoiceId === v.id}
                  selectedCategories={selectedCategories}
                  onTogglePreview={onTogglePreview}
                  onSelectVoice={onSelectVoice}
                  onSelectLanguage={onSelectLanguage}
                  onToggleCategory={toggleCategory}
                  onClose={onClose}
                  onDeleteVoice={onDeleteVoice}
                />
              ))}
            </div>

            {/* Bottom Footer Bar */}
            <VoiceExplorerFooter
              totalCount={combinedVoices.length}
              filteredCount={filteredVoices.length}
              isFilteredByLanguage={selectedLanguageCode !== 'all'}
              languageName={selectedLangObj.name}
              onClose={onClose}
              onOpenCloneModal={onOpenCloneModal}
            />
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
