// import { Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
// import { Spin } from 'antd';
import MainLayout from '../layouts/MainLayout';
import StoryListPage from '../pages/story/storyList/index';
import ConfigPage from '../pages/config/index';
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
        index: true,
        element: <ConfigPage />,
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
