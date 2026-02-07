import { Container, Title, Text, Button, Stack, Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function UnauthorizedPage() {
  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="xl">
        <Alert 
          icon={<IconAlertTriangle size="1rem" />} 
          title="Access Denied" 
          color="red"
          variant="light"
          ta="center"
        >
          You don&apos;t have permission to access this resource.
        </Alert>

        <div style={{ textAlign: 'center' }}>
          <Title order={1} mb="md">401 - Unauthorized</Title>
          <Text c="dimmed" size="lg" mb="xl">
            You need admin privileges to access this page.
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