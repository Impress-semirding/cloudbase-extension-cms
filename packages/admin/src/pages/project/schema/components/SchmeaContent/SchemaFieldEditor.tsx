import React, { useState, useEffect } from 'react'
import { useParams, useRequest } from 'umi'
import { useConcent } from 'concent'
import { updateSchema } from '@/services/schema'
import {
  Row,
  Col,
  Modal,
  Form,
  message,
  Input,
  Switch,
  Space,
  Button,
  Select,
  InputNumber,
  Typography,
  Alert,
} from 'antd'
import { ContentCtx, SchmeaCtx } from 'typings/store'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import { getFieldDefaultValueInput } from './Field'
import { FieldTypes } from '@/common'
import { random } from '@/utils'

const { TextArea } = Input
const { Option } = Select
const { Text } = Typography

// 不能设置默认值的类型
const NoDefaultValueTypes = ['File', 'Image', 'Array', 'Connect']

// 保留字段名
const ReservedFieldNames = ['_id', '_createTime', '_updateTime', '_status']

const AllowMultipleTypes = ['Image', 'File']

/**
 * 添加字段
 */
const SchemaFieldEditorModal: React.FC<{
  visible: boolean
  onClose: () => void
}> = ({ visible, onClose }) => {
  const { projectId } = useParams<any>()
  const ctx = useConcent<{}, SchmeaCtx>('schema')
  const contentCtx = useConcent<{}, ContentCtx>('content')
  const [formValue, setFormValue] = useState<any>()
  const [connectSchema, setConnectSchema] = useState<SchemaV2>()

  const {
    state: { currentSchema, schemas, fieldAction, selectedField },
  } = ctx

  // 添加字段
  const { run: createField, loading } = useRequest(
    async (fieldAttr: SchemaFieldV2) => {
      const existSameName = currentSchema?.fields?.find(
        (_: SchemaFieldV2) => _.name === fieldAttr.name
      )

      if (existSameName && fieldAction === 'create') {
        throw new Error(`已存在同名字段 ${fieldAttr.name}，请勿重复创建`)
      }

      // 过滤掉值为 undefined 的数据
      const field = Object.keys(fieldAttr)
        .filter((key) => typeof fieldAttr[key] !== 'undefined')
        .reduce(
          (val, key) => ({
            ...val,
            [key]: fieldAttr[key],
          }),
          {}
        )

      let fields = currentSchema?.fields || []

      // 创建新的字段
      if (fieldAction === 'create') {
        fields.push({
          ...field,
          order: fields.length,
          type: selectedField.type,
          id: random(32),
        } as any)
      }

      // 编辑字段
      if (fieldAction === 'edit') {
        const index = fields.findIndex(
          (_: any) => _.id === selectedField?.id || _.name === selectedField?.name
        )

        if (index > -1) {
          fields.splice(index, 1, {
            ...selectedField,
            ...field,
          })
        }
      }

      // 更新 schema fields
      await updateSchema(projectId, currentSchema?._id || '', {
        fields,
      })

      // 重新加载数据
      ctx.mr.getSchemas(projectId)
      contentCtx.mr.getContentSchemas(projectId)
      onClose()
    },
    {
      manual: true,
      onError: (e) =>
        message.error(
          fieldAction === 'create' ? `添加字段失败：${e.message}` : `更新字段失败:${e.message}`
        ),
      onSuccess: () => message.success(fieldAction === 'create' ? '添加字段成功' : '更新字段成功'),
    }
  )

  const fieldTypeName = FieldTypes.find((_) => _.type === selectedField.type)?.name

  const modalTitle =
    fieldAction === 'create' ? (
      `添加【${selectedField?.name}】字段`
    ) : (
      <Space>
        <Text>编辑【{selectedField?.displayName}】</Text>
        <Text type="secondary">#{fieldTypeName}</Text>
      </Space>
    )

  useEffect(() => {
    if (selectedField?.connectResource) {
      const schema = schemas.find((_: SchemaV2) => _._id === selectedField.connectResource)
      setConnectSchema(schema)
    }

    if (selectedField) {
      setFormValue(selectedField)
    }
  }, [selectedField])

  const isFieldNameReserved = ReservedFieldNames.includes(formValue?.name)

  return (
    <Modal
      centered
      destroyOnClose
      width={700}
      footer={null}
      visible={visible}
      title={modalTitle}
      maskClosable={false}
      onOk={() => onClose()}
      onCancel={() => onClose()}
    >
      {fieldAction === 'create' && selectedField?.description && (
        <Alert type="info" message={selectedField?.description} />
      )}
      <br />
      <Form
        name="basic"
        layout="vertical"
        labelCol={{ span: 6 }}
        initialValues={fieldAction === 'edit' ? selectedField : {}}
        onValuesChange={(changed, v) => {
          if (changed.connectResource) {
            const schema = schemas.find((_: SchemaV2) => _._id === v.connectResource)
            setConnectSchema(schema)
          }
          setFormValue(v)
        }}
        onFinish={(v: any) => {
          // 格式化为对象
          if (selectedField?.type === 'Object') {
            try {
              v.defaultValue = JSON.parse(v.defaultValue)
            } catch (error) {
              // ignore
            }
          }
          createField(v)
        }}
      >
        <Form.Item
          label="展示名称"
          name="displayName"
          rules={[{ required: true, message: '请输入展示名称！' }]}
        >
          <Input placeholder="展示名称，如文章标题" />
        </Form.Item>

        <Form.Item
          label="数据库字段名"
          name="name"
          rules={[
            { required: true, message: '请输入数据库名称！' },
            {
              message: '字段名只能使用英文字母、数字、-、_ 等符号',
              pattern: /^[a-z0-9A-Z_-]+$/,
            },
          ]}
        >
          <Input placeholder="数据库字段名，如 title" />
        </Form.Item>

        {/^_/.test(formValue?.name) && (
          <Alert
            message="系统会使用 _ 开头的单词作为系统字段名，为了避免和系统字段冲突，建议您使用其他命名规则"
            type="warning"
          />
        )}

        {isFieldNameReserved && (
          <Alert message={`${formValue.name} 是系统保留字段，请使用其他名称`} type="error" />
        )}

        <Form.Item label="描述" name="description">
          <TextArea placeholder="字段描述，如博客文章标题" />
        </Form.Item>

        {selectedField?.type === 'Connect' && (
          <>
            <Form.Item label="关联">
              <Space>
                <Form.Item
                  label="关联的内容"
                  name="connectResource"
                  rules={[{ required: true, message: '请选择关联内容！' }]}
                >
                  <Select style={{ width: 200 }}>
                    {schemas?.map((schema: SchemaV2) => (
                      <Option value={schema._id} key={schema._id}>
                        {schema.displayName}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item
                  label="关联的字段"
                  name="connectField"
                  rules={[{ required: true, message: '请选择关联内容字段！' }]}
                >
                  <Select style={{ width: 200 }} placeholder="关联字段">
                    {connectSchema?.fields?.length ? (
                      connectSchema.fields?.map((field: SchemaFieldV2) => (
                        <Option value={field.name} key={field.name}>
                          {field.displayName}
                        </Option>
                      ))
                    ) : (
                      <Option value="" key={selectedField.name} disabled>
                        空
                      </Option>
                    )}
                  </Select>
                </Form.Item>
              </Space>
            </Form.Item>
            <Form.Item>
              <div className="form-item">
                <Form.Item name="connectMany" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch disabled={fieldAction === 'edit'} />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0 }}>
                  <span>是否关联多项（支持选择多个关联文档）</span>
                  {fieldAction === 'edit' && (
                    <>
                      <br />
                      <Text type="warning">关联多项与关联单项无法转换</Text>
                    </>
                  )}
                </Form.Item>
              </div>
            </Form.Item>
          </>
        )}

        {NoDefaultValueTypes.includes(selectedField?.type) ? null : (
          <Form.Item
            label="默认值"
            name="defaultValue"
            rules={
              selectedField?.type === 'Object'
                ? [
                    {
                      validator: (_, value) => {
                        try {
                          const json = JSON.parse(value)
                          if (typeof json !== 'object') {
                            return Promise.reject('非法的 JSON 字符串')
                          }
                          return Promise.resolve()
                        } catch (error) {
                          return Promise.reject('非法的 JSON 字符串')
                        }
                      },
                    },
                  ]
                : []
            }
          >
            {getFieldDefaultValueInput(selectedField?.type)}
          </Form.Item>
        )}

        {['String', 'MultiLineString', 'Number'].includes(selectedField.type) && (
          <Form.Item style={{ marginBottom: 0 }}>
            <Row gutter={[24, 0]}>
              <Col flex="1 1 auto">
                <Form.Item
                  label={selectedField.type === 'Number' ? '最小值' : '最小长度'}
                  name="min"
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder={
                      selectedField.type === 'Number' ? '最小值，如 1' : '最小长度，如 1'
                    }
                  />
                </Form.Item>
              </Col>
              <Col flex="1 1 auto">
                <Form.Item
                  label={selectedField.type === 'Number' ? '最大值' : '最大长度'}
                  name="max"
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder={
                      selectedField.type === 'Number' ? '最大值，如 1000' : '最大长度，如 1000'
                    }
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form.Item>
        )}

        {selectedField.type === 'Enum' && (
          <>
            <Form.Item
              label="枚举元素类型"
              name="enumElementType"
              validateTrigger={['onChange']}
              rules={[
                {
                  required: true,
                  message: '请选择枚举元素类型！',
                },
              ]}
            >
              <Select placeholder="元素值类型">
                <Option value="string">字符串</Option>
                <Option value="number">数字</Option>
              </Select>
            </Form.Item>
            <Form.Item label="枚举元素">
              <Form.List name="enumElements">
                {(fields, { add, remove }) => {
                  return (
                    <div>
                      {fields?.map((field, index) => {
                        return (
                          <EnumListItem
                            key={index}
                            field={field}
                            onRemove={remove}
                            formValue={formValue}
                          />
                        )
                      })}
                      <Form.Item>
                        <Button
                          type="dashed"
                          onClick={() => {
                            add()
                          }}
                          style={{ width: '60%' }}
                        >
                          <PlusOutlined /> 添加枚举元素
                        </Button>
                      </Form.Item>
                    </div>
                  )
                }}
              </Form.List>
            </Form.Item>
          </>
        )}

        {AllowMultipleTypes.includes(selectedField.type) && (
          <Form.Item>
            <div className="form-item">
              <Form.Item style={{ marginBottom: 0 }}>
                <Text>允许多个内容</Text>
                <Form.Item name="isMultiple" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch />
                </Form.Item>
                <Text type="secondary">在创建内容时，允许创建多个内容，数据将以数组格式存储</Text>
              </Form.Item>
            </div>
          </Form.Item>
        )}

        <Form.Item>
          <div className="form-item">
            <Form.Item style={{ marginBottom: 0 }}>
              <Text>是否必需</Text>
              <Form.Item name="isRequired" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch />
              </Form.Item>
              <Text type="secondary">在创建内容时，此此段是必需要填写的</Text>
            </Form.Item>
          </div>
        </Form.Item>

        <Form.Item>
          <div className="form-item">
            <Form.Item style={{ marginBottom: 0 }}>
              <Text>是否隐藏</Text>
              <Form.Item name="isHidden" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch />
              </Form.Item>
              <Text type="secondary">在内容集合表格展示时隐藏该字段</Text>
            </Form.Item>
          </div>
        </Form.Item>

        <Form.Item>
          <div className="form-item">
            <Form.Item style={{ marginBottom: 0 }}>
              <Text>设为排序字段</Text>
              <Row align="middle">
                <Col flex="1 1 auto">
                  <Form.Item noStyle name="isOrderField" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col flex="0 0 auto">
                  {formValue?.isOrderField && (
                    <Form.Item noStyle name="orderDirection">
                      <Select style={{ width: '200px' }} placeholder="选择排序规则">
                        <Select.Option key="desc" value="desc">
                          降序（越大越靠前）
                        </Select.Option>
                        <Select.Option key="asc" value="asc">
                          升序（越小越靠前）
                        </Select.Option>
                      </Select>
                    </Form.Item>
                  )}
                </Col>
              </Row>
              <Text type="secondary">获取内容时根据此字段排序</Text>
            </Form.Item>
          </div>
        </Form.Item>

        <Form.Item>
          <Space size="large" style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => onClose()}>取消</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={isFieldNameReserved}
            >
              {fieldAction === 'create' ? '添加' : '更新'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

/**
 * 枚举值列表 Item
 */
const EnumListItem: React.FC<{ field: any; formValue: any; onRemove: (name: number) => void }> = (
  props
) => {
  const { field, formValue, onRemove } = props
  const enumValueType = formValue?.enumElementType || 'string'

  return (
    <Form.Item>
      <Form.Item noStyle name={[field.name, 'label']} validateTrigger={['onChange', 'onBlur']}>
        <Input placeholder="枚举元素展示别名，如 “已发布”" style={{ width: '45%' }} />
      </Form.Item>
      {enumValueType === 'number' && (
        <Form.Item noStyle name={[field.name, 'value']} validateTrigger={['onChange', 'onBlur']}>
          <InputNumber
            placeholder="枚举元素值，如 100"
            style={{
              width: '45%',
              marginLeft: '2%',
            }}
          />
        </Form.Item>
      )}
      {enumValueType === 'string' && (
        <Form.Item noStyle name={[field.name, 'value']} validateTrigger={['onChange', 'onBlur']}>
          <Input
            placeholder="枚举元素值，如 published"
            style={{
              width: '45%',
              marginLeft: '2%',
            }}
          />
        </Form.Item>
      )}
      <MinusCircleOutlined
        className="dynamic-delete-button"
        style={{ margin: '0 0 0 15px' }}
        onClick={() => {
          onRemove(field.name)
        }}
      />
    </Form.Item>
  )
}

export default SchemaFieldEditorModal