import { useState, useEffect } from 'react';
import { Select, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { clustersApi } from '../api/client';
import { useCluster } from '../hooks/useCluster';

interface NamespaceSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
  size?: 'small' | 'middle' | 'large';
  placeholder?: string;
  allowAll?: boolean;
}

const NAMESPACE_STORAGE_KEY = 'selected_namespace';

export const NamespaceSelector: React.FC<NamespaceSelectorProps> = ({
  value,
  onChange,
  style,
  size = 'middle',
  placeholder = '选择命名空间',
  allowAll = false,
}) => {
  const { clusterName } = useCluster();
  const [selectedNamespace, setSelectedNamespace] = useState(() => {
    const saved = localStorage.getItem(NAMESPACE_STORAGE_KEY);
    return saved || 'default';
  });

  const { data: namespacesData, isLoading } = useQuery({
    queryKey: ['namespaces', clusterName],
    queryFn: () => clustersApi.getNamespaces(clusterName),
    enabled: !!clusterName,
  });

  const namespaces = namespacesData?.items || [];

  useEffect(() => {
    if (value) {
      setSelectedNamespace(value);
    }
  }, [value]);

  const handleChange = (newValue: string) => {
    setSelectedNamespace(newValue);
    localStorage.setItem(NAMESPACE_STORAGE_KEY, newValue);
    onChange?.(newValue);
  };

  const options = [
    ...(allowAll ? [{ label: '全部命名空间', value: '*' }] : []),
    ...namespaces.map((ns: any) => ({
      label: ns.metadata?.name || ns.name,
      value: ns.metadata?.name || ns.name,
    })),
  ];

  if (isLoading) {
    return <Spin size="small" />;
  }

  if (namespaces.length === 0) {
    return (
      <Select
        style={style}
        size={size}
        placeholder="暂无命名空间"
        disabled
        options={[]}
      />
    );
  }

  return (
    <Select
      value={value || selectedNamespace}
      onChange={handleChange}
      style={style}
      size={size}
      placeholder={placeholder}
      options={options}
      showSearch
      allowClear={false}
    />
  );
};

export default NamespaceSelector;
