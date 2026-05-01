'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import type { User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ProfilePage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError('pick a file');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/avatar', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `upload failed: ${res.status}`);
      }
      await mutate('/api/user');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Profile
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Avatar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="size-16">
              <AvatarImage src={user?.avatarUrl ?? undefined} alt="avatar" />
              <AvatarFallback>
                {(user?.email ?? '?').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">
              {user?.email}
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <input
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp"
              className="block text-sm"
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                </>
              ) : (
                'Upload'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
