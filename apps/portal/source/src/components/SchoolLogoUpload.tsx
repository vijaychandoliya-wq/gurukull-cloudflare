import React, { useState, useRef, useCallback } from 'react';
import { Alert, Avatar, Button, message, Space, Typography, Upload } from 'antd';
import {
  DeleteOutlined,
  LoadingOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { apiClient } from '../services/api';

const { Text } = Typography;

function beforeUpload(file: File): boolean {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    message.error('Upload a JPEG, PNG or WebP image under 512 KB.');
    return false;
  }
  if (file.size > 512 * 1024) {
    message.error('File is too large. Maximum size is 512 KB.');
    return false;
  }
  return true;
}

export function SchoolLogoUpload({
  currentLogo,
  onUploaded,
  onRemoved,
}: {
  currentLogo: string | null;
  onUploaded?: (url: string) => void;
  onRemoved?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

  const customRequest: UploadProps['customRequest'] = useCallback(
    (options: any) => {
      const file = options.file as File;
      if (!file || typeof file === 'string') return;
      fileRef.current = file;
      setUploading(true);
      setError(null);
      const blob = file as File;
      apiClient
        .post('/api/admin/school/logo', blob, {
          headers: { 'Content-Type': blob.type },
        })
        .then(() => {
          message.success('School logo updated.');
          onUploaded?.('/api/admin/school/logo');
        })
        .catch((e: any) => {
          setError(e.response?.data?.message || 'Logo upload failed.');
        })
        .finally(() => {
          setUploading(false);
        });
    },
    [onUploaded]
  );

  const removeLogo = async () => {
    setUploading(true);
    setError(null);
    try {
      await apiClient.delete('/api/admin/school/logo');
      message.success('School logo removed.');
      onRemoved?.();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not remove logo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Text strong>School logo</Text>
      <Text type="secondary">
        Displayed on ID cards, certificates and the navigation sidebar. Use a square PNG or JPEG under 512 KB.
      </Text>
      {error && <Alert type="error" showIcon message={error} />}
      <Space align="start" size="middle">
        <Avatar
          shape="square"
          size={72}
          src={currentLogo ? `${currentLogo}?t=${Date.now()}` : undefined}
          icon={<PlusOutlined />}
          style={{ background: currentLogo ? 'transparent' : '#f0f0f0', color: '#999' }}
        />
        <Space direction="vertical" size="small">
          <Upload
            accept="image/jpeg,image/png,image/webp"
            showUploadList={false}
            beforeUpload={beforeUpload}
            customRequest={customRequest}
            disabled={uploading}
          >
            <Button icon={<UploadOutlined />} loading={uploading}>
              {currentLogo ? 'Replace' : 'Upload logo'}
            </Button>
          </Upload>
          {currentLogo && (
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
              loading={uploading}
              onClick={removeLogo}
            >
              Remove
            </Button>
          )}
        </Space>
      </Space>
    </Space>
  );
}
