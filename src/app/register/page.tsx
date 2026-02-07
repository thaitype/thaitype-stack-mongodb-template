import { Container, Center, Box, Title, Text, Stack } from '@mantine/core';
import { RegisterForm } from '~/components/auth/RegisterForm';
import { IconChecklist } from '@tabler/icons-react';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return (
    <Container size="sm" h="100vh">
      <Center h="100%">
        <Box w="100%" maw={450}>
          <Stack align="center" mb="lg">
            <IconChecklist size="2.5rem" color="var(--mantine-color-blue-6)" />
            <Title order={2} ta="center">
              Join Todo App
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              Create your account to start managing tasks efficiently
            </Text>
          </Stack>
          <RegisterForm />
        </Box>
      </Center>
    </Container>
  );
}