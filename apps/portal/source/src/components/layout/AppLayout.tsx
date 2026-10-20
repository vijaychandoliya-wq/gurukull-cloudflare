import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Input, Space, Typography, Tag, Badge } from 'antd';
import type { MenuProps } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  TeamOutlined,
  UserOutlined,
  SolutionOutlined,
  BookOutlined,
  ReadOutlined,
  CalendarOutlined,
  QuestionCircleOutlined,
  FileDoneOutlined,
  RiseOutlined,
  FileTextOutlined,
  NotificationOutlined,
  CheckSquareOutlined,
  SafetyCertificateOutlined,
  ContactsOutlined,
  WalletOutlined,
  CarOutlined,
  InboxOutlined,
  VideoCameraOutlined,
  SettingOutlined,
  IdcardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { ThemeSwitcher } from '../ThemeSwitcher';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

/**
 * Menu grouping follows the production SchoolAdminShell so the information
 * architecture matches app.gurukull.in rather than a flat invented list.
 */
const MENU: MenuProps['items'] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  {
    key: 'people',
    icon: <TeamOutlined />,
    label: 'People',
    children: [
      { key: '/students', icon: <TeamOutlined />, label: 'Students' },
      { key: '/parents', icon: <UserOutlined />, label: 'Parents' },
      { key: '/teachers', icon: <ReadOutlined />, label: 'Teachers' },
      { key: '/teacher-id-cards', icon: <IdcardOutlined />, label: 'Teacher ID cards' },
      { key: '/staff', icon: <SolutionOutlined />, label: 'Staff' },
      { key: '/staff-id-cards', icon: <IdcardOutlined />, label: 'Staff ID cards' },
      { key: '/id-cards', icon: <IdcardOutlined />, label: 'Student ID cards' },
    ],
  },
  {
    key: 'academics',
    icon: <BookOutlined />,
    label: 'Academics',
    children: [
      { key: '/academics', icon: <BookOutlined />, label: 'Classes & subjects' },
      { key: '/imports', icon: <InboxOutlined />, label: 'Bulk import' },
      { key: '/subjects', icon: <ReadOutlined />, label: 'Subjects catalog' },
      { key: '/timetable', icon: <CalendarOutlined />, label: 'Timetable' },
      { key: '/exams', icon: <SolutionOutlined />, label: 'Exams & grading' },
      { key: '/quizzes', icon: <QuestionCircleOutlined />, label: 'Online quizzes' },
      { key: '/certificates', icon: <FileDoneOutlined />, label: 'Certificates' },
      { key: '/promotion', icon: <RiseOutlined />, label: 'Promotions' },
      { key: '/homework', icon: <FileTextOutlined />, label: 'Homework' },
      { key: '/lesson-plans', icon: <FileTextOutlined />, label: 'Lesson plans' },
      { key: '/notices', icon: <NotificationOutlined />, label: 'Notices' },
    ],
  },
  {
    key: 'attendance',
    icon: <CheckSquareOutlined />,
    label: 'Attendance & wellbeing',
    children: [
      { key: '/attendance', icon: <CheckSquareOutlined />, label: 'Student attendance' },
      { key: '/leaves', icon: <CalendarOutlined />, label: 'Staff leave' },
      { key: '/discipline', icon: <SafetyCertificateOutlined />, label: 'Student conduct' },
    ],
  },
  {
    key: 'frontoffice',
    icon: <ContactsOutlined />,
    label: 'Front office',
    children: [
      { key: '/reception', icon: <ContactsOutlined />, label: 'Reception' },
      { key: '/alumni', icon: <TeamOutlined />, label: 'Alumni' },
    ],
  },
  {
    key: 'finance',
    icon: <WalletOutlined />,
    label: 'Finance & logistics',
    children: [
      { key: '/fees', icon: <WalletOutlined />, label: 'Fees & collections' },
      { key: '/payroll', icon: <WalletOutlined />, label: 'Payroll' },
      { key: '/transport', icon: <CarOutlined />, label: 'Transport' },
      { key: '/inventory', icon: <InboxOutlined />, label: 'Inventory' },
      { key: '/library', icon: <ReadOutlined />, label: 'Library' },
    ],
  },
  {
    key: 'communication',
    icon: <NotificationOutlined />,
    label: 'Communication',
    children: [
      { key: '/live-classes', icon: <VideoCameraOutlined />, label: 'Live classes' },
    ],
  },
  {
    key: 'reports',
    icon: <SettingOutlined />,
    label: 'Reports & settings',
    children: [
      { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
      { key: '/roles', icon: <UserOutlined />, label: 'Roles & access' },
      { key: '/feature-report', icon: <FileDoneOutlined />, label: 'Feature status' },
    ],
  },
];

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, schoolCode, schoolName, academicYear, schoolLogo, logout,hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const sectionKeys = ['people', 'academics', 'attendance', 'frontoffice', 'finance', 'communication', 'reports'];
  const activeSection = MENU.find((item: any) => item && Array.isArray(item.children) && item.children.some((child: any) => child.key === location.pathname)) as any;
  const [openKeys, setOpenKeys] = useState<string[]>(() => activeSection ? [activeSection.key] : ['people']);

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'My profile',
      onClick: () => navigate('/profile'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign out',
      onClick: () => {
        void logout().then(() => navigate('/login', { replace: true }));
      },
    },
  ];

  return (
    <Layout className="gk-shell">
      <Sider
        theme="light"
        width={248}
        collapsedWidth={0}
        collapsible
        collapsed={collapsed}
        trigger={null}
        breakpoint="lg"
        className="gk-sider"
      >
        <div className="gk-brand">
          <Avatar
            shape="square"
            size={42}
            src={schoolLogo || undefined}
            style={{ background: schoolLogo ? 'transparent' : '#2563eb' }}
          >
            {(schoolName || 'Gurukul').charAt(0)}
          </Avatar>
          {!collapsed && (
            <div className="gk-brand-copy">
              <Text strong ellipsis>{schoolName || 'Gurukul'}</Text>
              <Text type="secondary" ellipsis>{academicYear || 'School administration'}</Text>
            </div>
          )}
        </div>

        <Menu
          mode="inline"
          items={hasRole('schooladmin','superadmin')?MENU:[{key:'/dashboard',icon:<DashboardOutlined/>,label:'My workspace'},...(hasRole('teacher')?[{key:'/attendance',icon:<CheckSquareOutlined/>,label:'My class attendance'},{key:'/homework',icon:<FileTextOutlined/>,label:'My homework'},{key:'/lesson-plans',icon:<FileTextOutlined/>,label:'My lesson plans'},{key:'/exams',icon:<BookOutlined/>,label:'My assigned exams'},{key:'/quizzes',icon:<QuestionCircleOutlined/>,label:'My quizzes'},{key:'/live-classes',icon:<VideoCameraOutlined/>,label:'My live classes'}]:[]),...(hasRole('teacher','staff','nonteaching')?[{key:'/leaves',icon:<CalendarOutlined/>,label:'My leave'},{key:'/payroll',icon:<WalletOutlined/>,label:'My payslips'}]:[]),...(hasRole('student')?[{key:'/student-portal',icon:<BookOutlined/>,label:'My learning'}]:[]),...(hasRole('parent')?[{key:'/parent-portal',icon:<BookOutlined/>,label:'My children’s learning'}]:[]),{key:'/profile',icon:<UserOutlined/>,label:'My profile'}]}
          selectedKeys={[location.pathname]}
          openKeys={collapsed ? [] : openKeys}
          onOpenChange={(keys) => {
            const latest = keys.find((key) => !openKeys.includes(key));
            setOpenKeys(latest && sectionKeys.includes(latest) ? [latest] : keys.filter((key) => sectionKeys.includes(key)).slice(-1));
          }}
          defaultOpenKeys={['people']}
          onClick={({ key }) => {
            if (key.startsWith('/')) navigate(key);
          }}
          style={{ borderInlineEnd: 'none' }}
        />
      </Sider>

      <Layout>
        <Header
          className="gk-header"
        >
          <div className="gk-header-inner">
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            />
            <Input
              className="gk-global-search"
              prefix={<SearchOutlined />}
              placeholder="Search students, teachers, classes…"
              onPressEnter={(e) => {
                const q = (e.target as HTMLInputElement).value.trim();
                if (q) navigate(`/students?q=${encodeURIComponent(q)}`);
              }}
            />
          </Space>

          <Space size="middle">
            <ThemeSwitcher compact />
            <Badge dot>
              <Button type="text" shape="circle" icon={<NotificationOutlined />} onClick={() => navigate('/notices')} aria-label="Notifications" />
            </Badge>
            {schoolCode && <Tag color="blue">{schoolCode}</Tag>}
            <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
              <Button type="text" className="gk-profile-button">
                <Avatar icon={<UserOutlined />} />
                <span className="gk-profile-copy">
                  <Text strong>{user?.name}</Text>
                  <Text type="secondary">{user?.designation || user?.roles?.[0] || 'School admin'}</Text>
                </span>
              </Button>
            </Dropdown>
          </Space>
          </div>
        </Header>

        <Content className="gk-content">{children}</Content>
      </Layout>
    </Layout>
  );
};
