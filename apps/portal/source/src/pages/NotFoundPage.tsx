import {Result,Button,Space} from 'antd';
import {useNavigate} from 'react-router-dom';
export function NotFoundPage(){const navigate=useNavigate();return <Result status="404" title="Page not found" subTitle="This link may have changed. Use the navigation to find a page, or return to your overview." extra={<Space><Button onClick={()=>navigate(-1)}>Go back</Button><Button type="primary" onClick={()=>navigate('/dashboard')}>Open overview</Button></Space>}/>;}
