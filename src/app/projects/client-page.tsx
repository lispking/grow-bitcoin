'use client'

import React, {useEffect, useMemo, useState} from 'react'
import {
	Badge,
	Box,
	Button,
	Card,
	Checkbox,
	Container,
	Flex,
	Grid,
	Group,
	Image,
	Input,
	Select,
	Stack,
	Text,
	Title,
} from '@mantine/core'
import Link from 'next/link'
import NavigationBar from '@/components/NavigationBar'
import Footer from '@/components/Footer'

import {IconSearch, IconThumbUp, IconChevronDown} from '@tabler/icons-react'
import {useCurrentAddress, useCurrentSession, useRoochClient, useRoochClientQuery} from '@roochnetwork/rooch-sdk-kit'
import {useNetworkVariable} from '@/app/networks'
import {AnnotatedMoveStructView} from '@roochnetwork/rooch-sdk/src/client/types/generated'
import {Args, Transaction} from '@roochnetwork/rooch-sdk'
import {CreateSessionModal} from '@/components/session-model'

function ProjectCard({project, contractProject, adminId }: {
	project: Project,
	contractProject?: ContractProjectType,
	adminId: string,
}) {

	const client = useRoochClient()
	const contractAddr = useNetworkVariable('contractAddr')
	const contractVersion = useNetworkVariable('contractVersion')
	const session = useCurrentSession()
	const [showSessionModel, setShowSessionModel] = useState(false)
	const [loading, setLoading] = useState(false)
	const handleNewPorject = async () => {
		setLoading(true)
		const projectListObj = Args.object({
			address: contractAddr,
			module: `grow_information_${contractVersion}`,
			name: 'GrowProjectList'
		})
		console.log('session', session)
		if (!session) {
			setShowSessionModel(true)
			return
		}
		const tx = new Transaction()
		tx.callFunction({
			target: `${contractAddr}::grow_information_${contractVersion}::new_project`,
			args: [projectListObj, Args.string(project.slug), Args.objectId(adminId)]
		})
		const result = await client.signAndExecuteTransaction({
			transaction: tx,
			signer: session
		})
		console.log(result)
		if (result.execution_info.status.type === 'executed') {
			window.location.reload()
		} else if (result.execution_info.status.type === 'moveabort') {
			alert('Failed')
		}

		setLoading(false)
	}
	return (
		<Card radius="lg" h="100%" display="flex" withBorder>
			<Group align="center" gap="xs">
				<Image
					src={project.icon}
					alt="project name"
					w="40"
					miw="40"
					h="40"
					radius="50%"
				/>
				<Title order={4}>{project.name}</Title>
			</Group>
			<CreateSessionModal isOpen={showSessionModel} onClose={() => setShowSessionModel(false)}/>
			<Text c="gray.7" mt="8">
				{project.oneLiner}
			</Text>
			<Group gap="xs" mt="sm" mb="lg">
				{project.tags.map((tag) => (
					<Badge key={tag} bg="dark.3">
						{tag}
					</Badge>
				))}
			</Group>
			<Flex align="center" justify="space-between" mt="auto">
				{contractProject ? (
					<Button
						size="xs"
						variant="outline"
						leftSection={<IconThumbUp size="1rem"/>}
						radius="xl"
					>
						{contractProject.vote}
					</Button>
				) : (adminId != '' ? <Button
					size="xs"
					variant="outline"
					radius="xl"
					loading={loading}
					onClick={handleNewPorject}
				>
					New Project
				</Button> : <p/>)
				}
				<Button
					component={Link}
					size="xs"
					href={`/project/${project.slug}`}
					loading={loading}
					radius="xl"
				>
					View Project
				</Button>
			</Flex>
		</Card>
	)
}

export default function ClientProjectsPage({
																						 projects,
																						 tags,
																					 }: {
	projects: Project[];
	tags: string[];
}) {
	const [selectedTags, setSelectedTags] = useState<string[]>([])
	const [searchKeyword, setSearchKeyword] = useState<string>('')
	const [mobileTocExpanded, setMobileTocExpanded] = useState(false)
	const contractAddr = useNetworkVariable('contractAddr')
	const contractVersion = useNetworkVariable('contractVersion')
	const client = useRoochClient()
	const [contractProjects, setContractProjects] = useState<Map<string, ContractProjectType>>(new Map())
	const moduleName = `${contractAddr}::grow_information_${contractVersion}`
	const {data: project_table} = useRoochClientQuery('queryObjectStates', {
		filter: {
			object_type: `${moduleName}::GrowProjectList`
		},
		queryOption: {
			decode: true
		}
	})

	const currentAddress = useCurrentAddress()

	const {data: adminCap} = useRoochClientQuery('queryObjectStates', {
		filter: {
			object_type_with_owner: {
				object_type: `${moduleName}::ProjectCap`,
				owner: currentAddress?.toStr() || '',
			}
		},
		queryOption: {
			decode: true
		}
	})

	useEffect(() => {
		if (project_table && project_table.data.length > 0) {
			const view = project_table.data[0].decoded_value!.value
			const tableId = (((view['project_list'] as AnnotatedMoveStructView).value['handle']) as AnnotatedMoveStructView).value['id'] as string
			const isOpen = view['is_open'] as boolean
			client.listStates({
				accessPath: `/table/${tableId}`,
				stateOption: {
					decode: true
				}
			}).then((_contractProjects) => {
				const newContractProjects = new Map(contractProjects);
				_contractProjects.data?.map((item) => {
					const view = (item.state.decoded_value!.value['value'] as AnnotatedMoveStructView).value
					const id = view['id'] as string
					newContractProjects.set(id, {
						id: id,
						isOpen: isOpen,
						vote: view['vote_value'] as string
					})
				})
				setContractProjects(newContractProjects)
			})
		}
	}, [client, setContractProjects, project_table])

	useEffect(() => {
		if (selectedTags.length === tags.length) {
			setSelectedTags([])
		}
	}, [tags, selectedTags])

	const filteredProjects = useMemo(() => {
		if (selectedTags.length === 0 && searchKeyword === '') return projects

		if (selectedTags.length === 0 && !!searchKeyword.length) {
			return projects.filter((project) =>
				project.name.toLowerCase().includes(searchKeyword.toLowerCase()),
			)
		}

		return projects.filter(
			(project) =>
				selectedTags.some((tag) => project.tags.includes(tag)) &&
				project.name.toLowerCase().includes(searchKeyword.toLowerCase()),
		)
	}, [projects, selectedTags, searchKeyword])

	const FilterCheckboxGroup = useMemo(
		() => (
			<Stack gap="xs" mt="md">
				<Checkbox
					label="All"
					checked={!selectedTags.length}
					onChange={(e) => {
						if (e.currentTarget.checked) {
							setSelectedTags([])
						}
					}}
				/>
				{tags.map((tag) => (
					<Checkbox
						key={tag}
						label={tag}
						checked={selectedTags.includes(tag)}
						onChange={(e) => {
							if (e.currentTarget.checked) {
								setSelectedTags([...selectedTags, tag])
							} else {
								setSelectedTags(selectedTags.filter((t) => t !== tag))
							}
						}}
					/>
				))}
			</Stack>
		),
		[selectedTags, tags],
	)

	return (
		<>
			<NavigationBar/>

			<Container size="lg" py="lg">
				<Flex gap="lg" direction={{base: 'column', sm: 'row'}}>
					<Box flex="none" w="10rem" component="aside" visibleFrom="md">
						<Box style={{position: 'sticky', top: '1rem'}}>
							<Title order={3} mb="xs">
								Filters
							</Title>
							{FilterCheckboxGroup}
						</Box>
					</Box>
					<Box flex={1}>
						<Box
							bg="white"
							style={{position: 'sticky', top: 0, zIndex: 3}}
							hiddenFrom="md"
							py="md"
						>
							<Flex
								align="center"
								justify="space-between"
								onClick={() => setMobileTocExpanded(!mobileTocExpanded)}
							>
								<Title order={3}>Filters</Title>
								<IconChevronDown
									style={{
										transform: `rotate(${mobileTocExpanded ? '180deg' : '0deg'})`,
									}}
								/>
							</Flex>
							{mobileTocExpanded && FilterCheckboxGroup}
						</Box>

						<Flex gap="md" direction={{base: 'column', xs: 'row'}}>
							<Input
								flex={1}
								placeholder="Search projects"
								leftSection={<IconSearch size="1.25rem"/>}
								radius="md"
								value={searchKeyword}
								onChange={(e) => setSearchKeyword(e.currentTarget.value)}
							/>
							<Select
								placeholder="Sort by Votes"
								data={['Highest to Lowest', 'Lowest to Highest']}
								comboboxProps={{radius: 'md'}}
								radius="md"
							/>
						</Flex>
						<Grid pt="lg">
							{filteredProjects.length ? (
								filteredProjects.map((project) => (
									<Grid.Col span={{base: 12, xs: 6}} key={project.id}>
										<ProjectCard project={project}
																 contractProject={contractProjects.get(project.slug)}
																 adminId={adminCap && adminCap.data.length ? adminCap.data[0].id : ''}
										/>
									</Grid.Col>
								))
							) : (
								<Text>No Results</Text>
							)}
						</Grid>
					</Box>
				</Flex>
			</Container>

			<Footer/>
		</>
	)
}