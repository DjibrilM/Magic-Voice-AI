import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Cpu, Shield, User } from 'lucide-react'

export function Settings() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-4xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account credentials, workspace preferences, and voice engines.
        </p>
      </div>

      <div className="grid gap-6">
        <Card className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Cpu className="size-5 text-primary" />
            <h2 className="text-base font-semibold">Local Neural Voice Engines</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Speech synthesis runs 100% locally on your machine via CosyVoice 3 and Chatterbox T3 Turbo with zero external cloud dependencies.
          </p>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <span className="size-2 rounded-full bg-emerald-400" />
            Local Neural Offline Inference Active
          </div>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <User className="size-5 text-primary" />
            <h2 className="text-base font-semibold">User Profile</h2>
          </div>
          <div className="grid gap-3 max-w-md">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Display Name</label>
              <Input defaultValue="shadcn" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input defaultValue="m@example.com" />
            </div>
          </div>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            <h2 className="text-base font-semibold">Desktop Security & IPC</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Electron context isolation and nodeIntegration parameters are securely enforced.
          </p>
        </Card>
      </div>
    </div>
  )
}
