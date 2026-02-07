'use client';

import { 
  Container, 
  Title, 
  Text, 
  Button, 
  Group, 
  Stack, 
  Card, 
  Grid,
  AppShell,
} from '@mantine/core';
import { IconShieldCheck, IconSettings, IconChecklist } from '@tabler/icons-react';
import { useSession } from '~/lib/auth-client';
import { TodoList } from './_components/TodoList';
import { AppHeader } from './_components/AppHeader';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function Home() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <AppShell header={{ height: 60 }}>
        <AppHeader />
        <AppShell.Main>
          <Container size="md" py="xl">
            <Text ta="center">Loading...</Text>
          </Container>
        </AppShell.Main>
      </AppShell>
    );
  }

  if (session?.user) {
    return (
      <AppShell header={{ height: 60 }}>
        <AppHeader />
        <AppShell.Main>
          <Container size="lg" py="xl">
            <Stack gap="md" mb="xl">
              <Title order={1} mb="xs">
                Welcome back, {session.user.name}!
              </Title>
              <Text c="dimmed" size="sm">
                Manage your tasks efficiently
              </Text>
            </Stack>
            
            <TodoList />
          </Container>
        </AppShell.Main>
      </AppShell>
    );
  }

  return (
    <AppShell header={{ height: 60 }}>
      <AppHeader />
      <AppShell.Main>
        <Container size="md" py="xl">
          <Stack gap="xl" align="center">
            <div style={{ textAlign: 'center' }}>
              <Group justify="center" mb="md">
                <IconChecklist size="3rem" color="var(--mantine-color-blue-6)" />
              </Group>
              <Title order={1} size="3rem" mb="md">
                Todo App
              </Title>
              <Text size="xl" c="dimmed" mb="xl">
                A simple and secure task management app
              </Text>
            </div>

            <Group>
              <Button size="lg" component={Link} href="/register">
                Get Started
              </Button>
              <Button size="lg" variant="outline" component={Link} href="/login">
                Sign In
              </Button>
            </Group>

            <Grid mt="xl">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Card shadow="sm" padding="xl" radius="md" withBorder>
                  <IconShieldCheck size="2rem" color="var(--mantine-color-blue-6)" />
                  <Title order={4} mt="md" mb="xs">
                    Secure & Private
                  </Title>
                  <Text size="sm" c="dimmed">
                    Your tasks are stored securely with enterprise-grade authentication
                  </Text>
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 4 }}>
                <Card shadow="sm" padding="xl" radius="md" withBorder>
                  <IconChecklist size="2rem" color="var(--mantine-color-green-6)" />
                  <Title order={4} mt="md" mb="xs">
                    Task Management
                  </Title>
                  <Text size="sm" c="dimmed">
                    Create, organize, and track your tasks with an intuitive interface
                  </Text>
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 4 }}>
                <Card shadow="sm" padding="xl" radius="md" withBorder>
                  <IconSettings size="2rem" color="var(--mantine-color-violet-6)" />
                  <Title order={4} mt="md" mb="xs">
                    Simple & Clean
                  </Title>
                  <Text size="sm" c="dimmed">
                    Beautiful and responsive interface designed for productivity
                  </Text>
                </Card>
              </Grid.Col>
            </Grid>
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
