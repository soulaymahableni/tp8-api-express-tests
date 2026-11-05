// TP9 – Pipeline as Code avec Jenkins (contact-api)
// Pipeline déclaratif : Checkout → Install → Quality (Lint ∥ Unit tests) → Build → Push (main uniquement)

pipeline {
  agent any                                   // nœud Jenkins (a accès à Docker)

  options {
    timestamps()                              // plugin Timestamper
    disableConcurrentBuilds()                 // un seul build à la fois par branche
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timeout(time: 20, unit: 'MINUTES')
  }

  environment {
    IMAGE_NAME       = 'soulaymahableni/contact-api'   // <-- ton identifiant Docker Hub s'il est différent
    npm_config_cache = '.npm-cache'           // cache npm dans le workspace (le conteneur ne tourne pas en root)
  }

  stages {

    stage('Checkout') {
      steps {
        // Le checkout SCM est fait automatiquement ; on calcule le SHA court
        script { env.SHORT_SHA = env.GIT_COMMIT.take(7) }
        sh 'git log -1 --oneline'
        echo "Branche : ${env.BRANCH_NAME ?: env.GIT_BRANCH} – SHA : ${env.SHORT_SHA}"
      }
    }

    stage('Install') {
      agent {
        docker {
          image 'node:24-alpine'
          reuseNode true                      // même workspace que le pipeline
        }
      }
      steps {
        sh 'node --version && npm --version'
        sh 'npm ci'
      }
    }

    stage('Quality') {
      parallel {

        stage('Lint') {
          agent {
            docker {
              image 'node:24-alpine'
              reuseNode true
            }
          }
          steps {
            sh 'npm run lint'
          }
        }

        stage('Unit tests') {
          agent {
            docker {
              image 'node:24-alpine'
              reuseNode true
            }
          }
          steps {
            // tests unitaires seulement (les tests d'intégration ont besoin de PostgreSQL)
            sh 'npm test -- --reporter=default --reporter=junit --outputFile.junit=reports/junit.xml'
          }
          post {
            always {
              junit allowEmptyResults: true, testResults: 'reports/junit.xml'
            }
          }
        }
      }
    }

    stage('Build') {
      steps {
        sh """
          docker build \
            --label org.opencontainers.image.revision=${env.GIT_COMMIT} \
            -t ${env.IMAGE_NAME}:${env.SHORT_SHA} .
        """
        writeFile file: 'image.txt', text: "${env.IMAGE_NAME}:${env.SHORT_SHA}\n"
        archiveArtifacts artifacts: 'image.txt', fingerprint: true
      }
    }

    stage('Push') {
      // main uniquement : BRANCH_NAME (Multibranch) ou GIT_BRANCH (job Pipeline simple)
      when {
        expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub',
                          usernameVariable: 'DH_USER', passwordVariable: 'DH_TOKEN')]) {
          // Guillemets SIMPLES : c'est le shell qui substitue, le secret n'est jamais interpolé par Groovy
          sh 'echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin'
          sh 'docker push "$IMAGE_NAME:$SHORT_SHA"'
        }
      }
      post {
        always {
          sh 'docker logout || true'
        }
      }
    }
  }

  post {
    success {
      echo "✅ Build OK – image ${env.IMAGE_NAME}:${env.SHORT_SHA}"
    }
    failure {
      echo "❌ Échec du pipeline (build #${env.BUILD_NUMBER}) – voir la Console Output et l'onglet Tests"
    }
    always {
      sh "docker image rm ${env.IMAGE_NAME}:${env.SHORT_SHA} || true"
    }
    cleanup {
      cleanWs()                               // plugin Workspace Cleanup
    }
  }
}
