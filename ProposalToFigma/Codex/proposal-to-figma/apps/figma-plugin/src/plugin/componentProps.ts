export function getActualPropertyKey(instance: InstanceNode, visibleName: string): string | null {
  const props = instance.componentProperties;

  if (props[visibleName]) {
    return visibleName;
  }

  const found = Object.keys(props).find((key) => key === visibleName || key.startsWith(`${visibleName}#`));
  return found || null;
}

export function setComponentProp(instance: InstanceNode, visibleName: string, value: string | boolean): void {
  const key = getActualPropertyKey(instance, visibleName);
  if (!key) {
    throw new Error(
      `Component Property를 찾지 못했습니다:\n${visibleName}\n\n실제 Figma componentProperties key를 확인해 주세요.`
    );
  }

  instance.setProperties({
    [key]: value
  });
}

export function applyComponentProps(instance: InstanceNode, componentProps: Record<string, string | boolean>): void {
  for (const [visibleName, value] of Object.entries(componentProps)) {
    setComponentProp(instance, visibleName, value);
  }
}

