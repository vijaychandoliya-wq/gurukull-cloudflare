import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Input, Space, Typography, Tag, Breadcrumb } from 'antd';
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
import {humanize} from '../../ux/format';
import { ThemeSwitcher } from '../ThemeSwitcher';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

/**
 * Menu grouping follows the production SchoolAdminShell so the information
 * architecture matches app.gurukull.in rather than a flat invented list.
 */
const item=(key:string,label:string,icon:React.ReactNode)=>({key,icon,label});
const MENU:MenuProps['items']=[
 item('/dashboard','Overview',<DashboardOutlined/>),
 {key:'people',icon:<TeamOutlined/>,label:'People',children:[item('/students','Students',<TeamOutlined/>),item('/parents','Parents & guardians',<UserOutlined/>),item('/teachers','Teachers',<ReadOutlined/>),item('/staff','Staff',<SolutionOutlined/>),item('/id-cards','Student ID cards',<IdcardOutlined/>),item('/teacher-id-cards','Teacher ID cards',<IdcardOutlined/>),item('/staff-id-cards','Staff ID cards',<IdcardOutlined/>)]},
 {key:'academics',icon:<BookOutlined/>,label:'Academics',children:[item('/academics','Academic years & classes',<BookOutlined/>),item('/imports','Bulk import',<InboxOutlined/>),item('/subjects','Subjects & assignments',<ReadOutlined/>),item('/timetable','Timetable',<CalendarOutlined/>),item('/homework','Homework',<FileTextOutlined/>),item('/lesson-plans','Lesson plans',<FileTextOutlined/>)]},
 {key:'assessment',icon:<SolutionOutlined/>,label:'Assessment',children:[item('/exams','Exams, marks & results',<SolutionOutlined/>),item('/quizzes','Quizzes',<QuestionCircleOutlined/>)]},
 {key:'attendance',icon:<CheckSquareOutlined/>,label:'Attendance & wellbeing',children:[item('/attendance','Student attendance',<CheckSquareOutlined/>),item('/leaves','Staff leave',<CalendarOutlined/>),item('/discipline','Student conduct',<SafetyCertificateOutlined/>)]},
 {key:'finance',icon:<WalletOutlined/>,label:'Finance',children:[item('/fees','Fees & collections',<WalletOutlined/>),item('/payroll','Payroll',<WalletOutlined/>)]},
 {key:'operations',icon:<InboxOutlined/>,label:'Campus operations',children:[item('/library','Library',<ReadOutlined/>),item('/transport','Transport',<CarOutlined/>),item('/inventory','Inventory',<InboxOutlined/>),item('/reception','Reception',<ContactsOutlined/>)]},
 {key:'communication',icon:<NotificationOutlined/>,label:'Communication',children:[item('/notices','Notices',<NotificationOutlined/>),item('/live-classes','Live classes',<VideoCameraOutlined/>)]},
 {key:'records',icon:<FileDoneOutlined/>,label:'Records',children:[item('/certificates','Certificates',<FileDoneOutlined/>),item('/promotion','Promotions & graduation',<RiseOutlined/>),item('/alumni','Alumni',<TeamOutlined/>)]},
 {key:'reports',icon:<SettingOutlined/>,label:'Administration',children:[item('/settings','School settings',<SettingOutlined/>),item('/roles','Users & access',<UserOutlined/>),item('/feature-report','Feature status',<FileDoneOutlined/>)]},
];

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, schoolCode, schoolName, academicYear, schoolLogo, logout,hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navigateSafely=(path:string)=>{const event=new CustomEvent('gk-before-navigate',{cancelable:true,detail:{proceed:()=>navigate(path)}});if(window.dispatchEvent(event))navigate(path);};

  const sectionKeys = ['people','academics','assessment','attendance','finance','operations','communication','records','reports'];
  const routeRoot='/'+location.pathname.split('/')[1];
  const rootPath=['/marks-entry','/exam-results'].includes(routeRoot)?'/exams':routeRoot;
  const activeSection = MENU.find((item: any) => item && Array.isArray(item.children) && item.children.some((child: any) => child.key === rootPath)) as any;
  const [openKeys, setOpenKeys] = useState<string[]>(() => activeSection ? [activeSection.key] : ['people']);
  useEffect(()=>{if(activeSection)setOpenKeys([activeSection.key]);},[rootPath]);
  const currentPage=(MENU.flatMap((item:any)=>item?.children||[item]) as any[]).find(item=>item.key===rootPath)?.label||humanize(rootPath.slice(1));

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'My profile',
      onClick: () => navigateSafely('/profile'),
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
    <Layout className="gk-shell"><a href="#portal-main" className="gk-skip-link">Skip to content</a>
      <Sider
        theme="light"
        width={248}
        collapsedWidth={0}
        collapsible
        collapsed={collapsed}
        trigger={null}
        breakpoint="lg"
        onBreakpoint={matches=>setCollapsed(matches)}
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
            <div className="gk-brand-copy" title={schoolName||'Gurukul'}>
              <Text strong ellipsis>{schoolName || 'Gurukul'}</Text>
              <Text type="secondary" ellipsis>{academicYear || 'School administration'}</Text>
            </div>
          )}
        </div>

        <Menu
          mode="inline"
          items={hasRole('schooladmin','superadmin')?MENU:[{key:'/dashboard',icon:<DashboardOutlined/>,label:'My workspace'},...(hasRole('teacher')?[{key:'/attendance',icon:<CheckSquareOutlined/>,label:'My class attendance'},{key:'/homework',icon:<FileTextOutlined/>,label:'My homework'},{key:'/lesson-plans',icon:<FileTextOutlined/>,label:'My lesson plans'},{key:'/exams',icon:<BookOutlined/>,label:'My assigned exams'},{key:'/quizzes',icon:<QuestionCircleOutlined/>,label:'My quizzes'},{key:'/live-classes',icon:<VideoCameraOutlined/>,label:'My live classes'}]:[]),...(hasRole('teacher','staff','nonteaching')?[{key:'/leaves',icon:<CalendarOutlined/>,label:'My leave'},{key:'/payroll',icon:<WalletOutlined/>,label:'My payslips'}]:[]),...(hasRole('student')?[{key:'/student-portal',icon:<BookOutlined/>,label:'My learning'}]:[]),...(hasRole('parent')?[{key:'/parent-portal',icon:<BookOutlined/>,label:'My children’s learning'}]:[]),{key:'/profile',icon:<UserOutlined/>,label:'My profile'}]}
          selectedKeys={[rootPath]}
          openKeys={collapsed ? [] : openKeys}
          onOpenChange={(keys) => {
            const latest = keys.find((key) => !openKeys.includes(key));
            setOpenKeys(latest && sectionKeys.includes(latest) ? [latest] : keys.filter((key) => sectionKeys.includes(key)).slice(-1));
          }}
          defaultOpenKeys={['people']}
          onClick={({ key }) => {
            if (key.startsWith('/')){navigateSafely(key);if(window.matchMedia('(max-width: 991px)').matches)setCollapsed(true);}
          }}
          style={{ borderInlineEnd: 'none' }}
        />
      </Sider>
      {!collapsed&&<button className="gk-nav-backdrop" aria-label="Close navigation" onClick={()=>setCollapsed(true)}/>}
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
            {hasRole('schooladmin','superadmin')&&<Input
              aria-label="Search students"
              className="gk-global-search"
              prefix={<SearchOutlined />}
              placeholder="Search students by name or admission…"
              onPressEnter={(e) => {
                const q = (e.target as HTMLInputElement).value.trim();
                if (q) navigateSafely(`/students?q=${encodeURIComponent(q)}`);
              }}
            />}
          </Space>

          <Space size="middle">
            <ThemeSwitcher compact />

              <Button type="text" shape="circle" icon={<NotificationOutlined />} onClick={() => navigateSafely('/notices')} aria-label="Notifications" />

            {schoolCode && <Tag color="blue">{schoolCode}</Tag>}
            <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
              <Button type="text" className="gk-profile-button">
                <Avatar icon={<UserOutlined />} />
                <span className="gk-profile-copy">
                  <Text strong>{user?.name}</Text>
                  <Text type="secondary">{humanize(user?.designation || user?.roles?.[0] || 'schooladmin')}</Text>
                </span>
              </Button>
            </Dropdown>
          </Space>
          </div>
        </Header>

        <Content className="gk-content" id="portal-main" tabIndex={-1}><Breadcrumb className="gk-breadcrumb" items={[{title:<span>{activeSection?.label||'School'}</span>},{title:currentPage},...(location.pathname!==rootPath?[{title:'Record details'}]:[])]}/>{children}</Content>
      </Layout>
    </Layout>
  );
};
