import './index.css';
import { Menu } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const ConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = location.pathname.startsWith('/config/chat')
    ? 'chat'
    : 'chat';

  return (
    <div className="config-page">
      <aside className="config-page__aside">
        <div className="config-page__aside-title">配置</div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={[
            {
              key: 'chat',
              icon: <MessageOutlined />,
              label: '大模型对话',
            },
          ]}
          onClick={({ key }) => {
            if (key === 'chat') {
              navigate('/config/chat');
            }
          }}
        />
      </aside>
      <main className="config-page__main">
        <Outlet />
      </main>
    </div>
  );
};

export default ConfigPage;
