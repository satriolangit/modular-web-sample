import { useState } from 'react';
import { useQueryClient, useTranslation } from '@arsi/container';
import { Button, Card, Input, Label } from '@arsi/shared';

import { SamplePageShell } from '../components/SamplePageShell';
import { useCreateSamplePost, useSamplePosts } from '../hooks/useSample';
import { sampleKeys } from '../queryKeys';

export function SampleQueryPage() {
  const { t } = useTranslation('module-sample');
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const posts = useSamplePosts({ limit: 5 });
  const createPost = useCreateSamplePost();

  const handleCreate = () => {
    if (!title.trim() || !body.trim()) {
      return;
    }
    createPost.mutate(
      { title, body, userId: 1 },
      {
        onSuccess: () => {
          setTitle('');
          setBody('');
        },
      },
    );
  };

  return (
    <SamplePageShell titleKey="query.title" descriptionKey="query.description">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sample-post-title">{t('query.titleLabel')}</Label>
            <Input
              id="sample-post-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sample-post-body">{t('query.bodyLabel')}</Label>
            <Input
              id="sample-post-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={handleCreate} disabled={createPost.isPending}>
            {t('query.create')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: sampleKeys.posts() });
            }}
          >
            {t('query.invalidate')}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">{t('query.listTitle')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('query.status', {
            fetching: String(posts.isFetching),
            updatedAt: posts.dataUpdatedAt
              ? new Date(posts.dataUpdatedAt).toLocaleTimeString()
              : '-',
          })}
        </p>
        <ul className="mt-3 space-y-2">
          {posts.data?.posts.map((post) => (
            <li key={post.id} className="rounded-md border p-3">
              <p className="text-sm font-medium">{post.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{post.body}</p>
            </li>
          ))}
        </ul>
      </Card>
    </SamplePageShell>
  );
}
