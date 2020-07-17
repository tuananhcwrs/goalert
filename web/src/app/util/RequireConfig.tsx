import React, { useContext } from 'react'
import gql from 'graphql-tag'
import { useQuery } from 'react-apollo'
import { ConfigType, ConfigValue } from '../../schema'

type Value = boolean | number | string | string[] | null
type ConfigData = {
  [x: string]: Value
}

const ConfigContext = React.createContext({
  config: [] as ConfigValue[],
  isAdmin: false as boolean,
  userID: null as string | null,
})
ConfigContext.displayName = 'ConfigContext'

const query = gql`
  query {
    user {
      id
      role
    }
    config {
      id
      type
      value
    }
  }
`

type ConfigProviderProps = {
  children: React.ReactNode
}

export function ConfigProvider(props: ConfigProviderProps): React.ReactNode {
  const { data } = useQuery(query)

  return (
    <ConfigContext.Provider
      value={{
        config: data?.config || [],
        isAdmin: data?.user?.role === 'admin',
        userID: data?.user?.id || null,
      }}
    >
      {props.children}
    </ConfigContext.Provider>
  )
}

function parseValue(type: ConfigType, value: string): Value {
  if (!type) return null
  switch (type) {
    case 'boolean':
      return value === 'true'
    case 'integer':
      return parseInt(value, 10)
    case 'string':
      return value
    case 'stringList':
      if (value === '') return []
      return value.split('\n')
  }

  throw new TypeError(`unknown config type '${type}'`)
}

function isTrue(value: Value): boolean {
  if (Array.isArray(value)) return value.length > 0

  return Boolean(value)
}

const mapConfig = (value: ConfigValue[]): ConfigData => {
  const data: ConfigData = {}
  value.forEach((v) => {
    data[v.id] = parseValue(v.type, v.value)
  })
  return data
}

export type SessionInfo = {
  isAdmin: boolean
  userID: string | null
  ready: boolean
}

// useSessionInfo returns an object with the following properties:
// - `isAdmin` true if the current session is an admin
// - `userID` the current users ID
// - `ready` true if session/config info is available (e.g. before initial page load/fetch)
export function useSessionInfo(): SessionInfo {
  const ctx = useContext(ConfigContext)

  return {
    isAdmin: ctx.isAdmin,
    userID: ctx.userID,
    ready: Boolean(ctx.userID),
  }
}

// useConfig will return the current public configuration as an object
// like:
//
// ```js
// {
//   "Mailgun.Enable": true
// }
// ```
export function useConfig(): ConfigData {
  return mapConfig(useContext(ConfigContext).config)
}

// useConfigValue will return an array of config values
// for the provided fields.
//
// Example:
// ```js
// const [mailgun, slack] = useConfigValue('Mailgun.Enable', 'Slack.Enable')
// ```
export function useConfigValue(...fields: string[]): Value[] {
  const config = useConfig()
  return fields.map((f) => config[f])
}

export function Config(props: {
  children: (x: ConfigData, s?: SessionInfo) => React.ReactNode
}): React.ReactNode {
  return props.children(useConfig(), useSessionInfo()) || null
}

export type RequireConfigProps = {
  configID: string
  // test to determine whether or not children or else is returned
  test?: (x: Value) => boolean

  // react element to render if checks failed
  else?: React.ReactNode
  isAdmin?: boolean
  children: React.ReactNode
}

export default function RequireConfig(
  props: RequireConfigProps,
): React.ReactNode {
  const {
    configID,
    test = isTrue,
    isAdmin: wantIsAdmin,
    children,
    else: elseValue = null,
  } = props
  const config = useConfig()
  const { isAdmin } = useSessionInfo()

  if (wantIsAdmin && !isAdmin) {
    return elseValue
  }
  if (configID && !test(config[configID])) {
    return elseValue
  }

  return children
}