import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { debounce } from '../../../debounce'

interface UseDebouncedFilterResult {
  localValue: string
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export function useDebouncedFilter(
  value: string,
  onChange: (value: string) => void
): UseDebouncedFilterResult {
  const [localValue, setLocalValue] = useState(value)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const debouncedChange = useRef(
    debounce((nextValue: string) => onChangeRef.current(nextValue), 300)
  ).current

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value
    setLocalValue(nextValue)
    debouncedChange(nextValue)
  }

  return { localValue, handleChange }
}
