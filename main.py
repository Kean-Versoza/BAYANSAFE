from src.core.game import Game
from src.states.login_state import LoginState


def main():
    game = Game()
    game.state_manager.push(LoginState(game))
    game.run()


if __name__ == "__main__":
    main()
