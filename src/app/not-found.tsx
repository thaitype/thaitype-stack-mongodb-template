import { Container, Title, Text, Button, Stack } from '@mantine/core';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="xl">
        <div style={{ textAlign: 'center' }}>
          <Title order={1} size="6rem" c="dimmed" mb="md">404</Title>
          <Title order={2} mb="md">Page Not Found</Title>
          <Text c="dimmed" size="lg" mb="xl">
            The page you&apos;re looking for doesn&apos;t exist.
          </Text>
        </div>

        <Link href="/" style={{ textDecoration: 'none' }}>
          <Button size="lg">
            Go Home
          </Button>
        </Link>
      </Stack>
    </Container>
  );
}