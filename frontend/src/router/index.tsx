// import { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
// import { Spin } from 'antd';
import MainLayout from '../layouts/MainLayout';
import StoryListPage from '../pages/story/storyList/index';
import ConfigPage from '../pages/config/index';
import ChatPage from '../pages/config/chat/index';
import StoryPage from '../pages/story/storyWrite/index';

// function PageLoading() {
//   return (
//     <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
//       <Spin size="large" />
//     </div>
//   );
// }

// function LazyPage({ children }: { children: React.ReactNode }) {
//   return <Suspense fallback={<PageLoading />}>{children}</Suspense>;
// }

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <StoryListPage />,
      },
    ],
  },
  {
    path: 'config',
    element: <MainLayout />,
    children: [
      {
        element: <ConfigPage />,
        children: [
          {
            index: true,
            element: <Navigate to="chat" replace />,
          },
          {
            path: 'chat',
            element: <ChatPage />,
          },
        ],
      },
    ],
  },
  {
    path: 'story/:id',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <StoryPage />,
      },
    ],
  },
]);
