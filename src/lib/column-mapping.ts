export type ColumnMapping = Record<string, number | null>;
export interface MappingField { key: string; label: string }

export const itsmMappingFields: MappingField[] = [
  { key: 'key', label: 'Chave do ticket' }, { key: 'issueId', label: 'ID do ticket' },
  { key: 'parent', label: 'Chave do incidente pai' }, { key: 'parentId', label: 'ID do incidente pai' },
  { key: 'reason', label: 'Motivo do alarme' }, { key: 'summary', label: 'Resumo' },
  { key: 'itemType', label: 'Tipo de item' }, { key: 'responsible', label: 'Responsável' },
  { key: 'status', label: 'Status' }, { key: 'created', label: 'Criado' },
  { key: 'updated', label: 'Atualizado' }, { key: 'resolved', label: 'Resolvido' },
  { key: 'due', label: 'Prazo' }, { key: 'link1', label: 'Link interno 1' }, { key: 'link2', label: 'Link interno 2' },
  { key: 'sourceType', label: 'Categoria / TIPO' }, { key: 'operator', label: 'Operadora' }, { key: 'locality', label: 'Localidade' },
];
export const subtaskMappingFields: MappingField[] = [
  ...itsmMappingFields,
  { key: 'unitType', label: 'Tipo de unidade / TIPO_UND' },
  { key: 'unitName', label: 'Nome da unidade / UND_NOME' },
];

export const alarmMappingFields: MappingField[] = [
  { key: 'alarm', label: 'Alarme / evento' }, { key: 'device', label: 'Dispositivo / ativo' },
  { key: 'start', label: 'Horário inicial' }, { key: 'end', label: 'Horário final' },
  { key: 'duration', label: 'Duração (H:M:S ou formato original)' }, { key: 'responsible', label: 'Responsável' },
  { key: 'ticket', label: 'Ticket / incidente' }, { key: 'comment', label: 'Comentário' },
  { key: 'operator', label: 'Operadora' }, { key: 'locality', label: 'Localidade' },
  { key: 'sourceType', label: 'Categoria / TIPO' }, { key: 'deviceType', label: 'Tipo de dispositivo' },
  { key: 'trap', label: 'Origem / trap' }, { key: 'classification', label: 'Classificação' },
];

export function applyColumnMapping<T extends Record<string, number | undefined>>(defaults: T, overrides: ColumnMapping, columnCount: number): T {
  const result = { ...defaults };
  for (const [field, index] of Object.entries(overrides)) {
    if (!(field in defaults)) continue;
    if (index !== null && (!Number.isInteger(index) || index < 0 || index >= columnCount)) throw new Error(`A coluna selecionada para ${field} não existe neste arquivo. Revise o mapeamento.`);
    result[field as keyof T] = (index === null ? undefined : index) as T[keyof T];
  }
  return result;
}

export function resolvedColumnMapping(columns: Record<string, number | undefined>): ColumnMapping {
  return Object.fromEntries(Object.entries(columns).map(([key, value]) => [key, value ?? null]));
}
