import { Layout, Typography } from 'antd';
import { ProductOutlined } from '@ant-design/icons';
import { Outlet, useNavigate } from 'react-router-dom';

const { Header, Content, Footer } = Layout;
const { Text } = Typography;

export default function MainLayout() {
  const navigate = useNavigate()
  const gotoStoryList = () => {
    navigate('/');
  }
  const gotoConfig = () => {
    navigate('/config/chat');
  }
  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
        <Text style={{ color: '#fff',fontSize: 18, fontWeight: 600, cursor: 'pointer' }} onClick={() => gotoStoryList()}>
          Story Assistant
        </Text>
        <ProductOutlined style={{ fontSize: 24 }} onClick={() => gotoConfig()}/>
      </Header>
      <Content style={{ height: 'calc(100% - 64px)', padding: '16px' }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
